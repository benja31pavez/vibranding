import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Copy, Link2, Package, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  EmptyState,
  ErrorState,
  FitList,
  ListSkeleton,
  Panel,
  StatusBadge,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fichaKeys, formatDate, useUserKey, type FichaOverview } from "../ficha/fichaQueries";
import { OnboardingLinkPanel } from "../ficha/OnboardingLinkPanel";

const LINKS_LIMIT = 200;

interface ReviewLink {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  deliverableTitle: string;
}

type LinkState = "vigente" | "vencido" | "revocado";

const STATE_UI: Readonly<Record<LinkState, { label: string; tone: StatusTone }>> = {
  vigente: { label: "Vigente", tone: "success" },
  vencido: { label: "Vencido", tone: "neutral" },
  revocado: { label: "Revocado", tone: "neutral" },
};

function linkState(link: ReviewLink, now: number): LinkState {
  if (link.revoked) return "revocado";
  return new Date(link.expiresAt).getTime() > now ? "vigente" : "vencido";
}

/**
 * Enlaces de revisión de entregables (deliverable_review_links) compartidos con el
 * cliente: se crean desde "Entregables" con "Compartir enlace" y duran 14 días.
 */
function useReviewLinks(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: [...fichaKeys.all(userKey, clientId), "review-links"] as const,
    queryFn: async (): Promise<ReviewLink[]> => {
      const { data, error } = await supabase
        .from("deliverable_review_links")
        .select("id,token,created_at,expires_at,revoked,deliverables(title)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(LINKS_LIMIT);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => {
        const deliverable = row.deliverables as { title: string } | { title: string }[] | null;
        const title = Array.isArray(deliverable) ? deliverable[0]?.title : deliverable?.title;
        return {
          id: row.id,
          token: row.token,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          revoked: row.revoked,
          deliverableTitle: title?.trim() || "Entregable",
        };
      });
    },
  });
}

function ReviewLinkRow({ link, now }: { link: ReviewLink; now: number }) {
  const state = linkState(link, now);
  const ui = STATE_UI[state];
  const url = typeof window !== "undefined" ? `${window.location.origin}/review/${link.token}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar; ábrelo y copia la dirección a mano.");
    }
  };
  return (
    <div className="flex min-w-0 items-center gap-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-surface-2">
        <Package aria-hidden className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium" title={link.deliverableTitle}>
          {link.deliverableTitle}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Creado el {formatDate(link.createdAt)} ·{" "}
          {state === "vigente" ? `Vence el ${formatDate(link.expiresAt)}` : ui.label}
        </p>
      </div>
      <StatusBadge
        status={state}
        label={ui.label}
        tone={ui.tone}
        className="hidden sm:inline-flex"
      />
      {state === "vigente" && (
        <>
          <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Abrir<span className="sr-only"> enlace de revisión de {link.deliverableTitle}</span>
            </a>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => void copy()}
            aria-label={`Copiar enlace de revisión de ${link.deliverableTitle}`}
            title="Copiar enlace"
          >
            <Copy aria-hidden className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

const MOBILE_LIST_PAGE = 8;

interface ArchivosCompartidosProps {
  clientId: string;
  overview: FichaOverview | undefined;
}

/**
 * "Compartidos con el cliente": enlaces de revisión de entregables (para que el cliente
 * vea y apruebe sin entrar al portal) y el link de onboarding, que es la forma de que el
 * cliente suba material.
 */
export function ArchivosCompartidos({ clientId, overview }: ArchivosCompartidosProps) {
  const links = useReviewLinks(clientId);
  // Una sola marca de tiempo por render: el estado de cada enlace es coherente.
  const [now] = useState(() => Date.now());

  return (
    <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-3 md:grid-rows-[minmax(0,1fr)] md:gap-3">
      <Panel
        fill
        title="Enlaces de revisión"
        icon={Share2}
        description="Enlaces públicos de 14 días para que el cliente revise y apruebe un entregable."
        className="md:col-span-2"
      >
        {links.isLoading ? (
          <ListSkeleton rows={4} label="Cargando enlaces compartidos" />
        ) : links.error ? (
          <ErrorState message={links.error.message} onRetry={() => void links.refetch()} />
        ) : (links.data ?? []).length === 0 ? (
          <EmptyState
            size="compact"
            icon={Share2}
            title="Aún no hay enlaces compartidos"
            description="Se crean desde Entregables con «Compartir enlace». Aquí verás cuáles siguen vigentes y podrás copiarlos."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/clients/$clientId/deliverables" params={{ clientId }}>
                  <Package aria-hidden className="mr-1.5 h-4 w-4" /> Ir a Entregables
                </Link>
              </Button>
            }
          />
        ) : (
          <FitList
            items={links.data ?? []}
            getKey={(l) => l.id}
            label="Enlaces de revisión"
            defaultPageSize={MOBILE_LIST_PAGE}
            renderItem={(l) => <ReviewLinkRow link={l} now={now} />}
          />
        )}
      </Panel>

      <div className="flex min-w-0 flex-col gap-4 md:gap-3">
        {overview ? (
          <OnboardingLinkPanel clientId={clientId} overview={overview} />
        ) : (
          <Panel title="Link de onboarding" icon={Link2}>
            <ListSkeleton rows={1} label="Cargando link de onboarding" />
          </Panel>
        )}
        <Panel title="Cómo recibe archivos el cliente" icon={Link2}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Con el link de onboarding sube sus archivos iniciales (logo, fotos, documentos).
            </li>
            <li>
              Desde su portal puede subir archivos en «Archivos»; aparecen en Carpetas › Subidos por
              el cliente.
            </li>
            <li>
              Los enlaces de revisión le permiten ver y aprobar un entregable sin iniciar sesión.
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
