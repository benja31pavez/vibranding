import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { EmptyState, ErrorState, ListSkeleton, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { getOnboardingFileUrl } from "@/lib/onboarding/intake.functions";
import { safeExternalHref } from "@/lib/onboarding/links";
import {
  ACCESS_STATE_LABELS,
  LINK_LABELS,
  displayFileName,
  type AccessState,
  type LinkKey,
} from "@/lib/onboarding/schema";
import { FactGrid } from "./FactGrid";
import { fichaKeys, formatDate, useUserKey } from "./fichaQueries";

type Intake = Tables<"client_intake">;

interface AccessEntry {
  servicio: string;
  estado: string;
  nota?: string;
}

function parseAccesses(value: unknown): AccessEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const { servicio, estado, nota } = v as Record<string, unknown>;
    if (typeof servicio !== "string") return [];
    return [
      {
        servicio,
        estado: typeof estado === "string" ? estado : "pendiente",
        nota: typeof nota === "string" ? nota : undefined,
      },
    ];
  });
}

function parseLinks(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "string" ? [[k, v] as [string, string]] : [],
  );
}

const ACCESS_TONE: Readonly<Record<string, "success" | "warning" | "neutral">> = {
  compartido: "success",
  pendiente: "warning",
  no_aplica: "neutral",
};

/** Formulario de onboarding del cliente (null = aún no lo envía). Solo editores. */
export function useClientIntake(clientId: string, canEdit: boolean) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: fichaKeys.intake(userKey, clientId),
    enabled: canEdit,
    queryFn: async (): Promise<Intake | null> => {
      const { data, error } = await supabase
        .from("client_intake")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** Datos que el cliente envió en el formulario público de onboarding (solo lectura, solo editores). */
export function OnboardingIntakePanel({
  clientId,
  canEdit,
}: {
  clientId: string;
  canEdit: boolean;
}) {
  const intake = useClientIntake(clientId, canEdit);

  if (!canEdit) {
    return (
      <Panel title="Onboarding" icon={ClipboardList}>
        <p className="text-sm text-muted-foreground">
          Solo los editores del cliente pueden ver los datos del onboarding.
        </p>
      </Panel>
    );
  }

  const data = intake.data;
  return (
    <Panel
      title="Onboarding"
      icon={ClipboardList}
      description={data ? `Enviado el ${formatDate(data.submitted_at)}` : undefined}
      actions={data ? <StatusBadge status="done" label="Recibido" /> : null}
    >
      {intake.isLoading ? (
        <ListSkeleton rows={3} label="Cargando onboarding" />
      ) : intake.error ? (
        <ErrorState
          message={intake.error.message}
          onRetry={() => void intake.refetch()}
          retrying={intake.isFetching}
        />
      ) : !data ? (
        <EmptyState
          size="compact"
          title="Aún no envía el formulario"
          description="Comparte el link de onboarding para que el cliente complete sus datos."
        />
      ) : (
        <IntakeDetails clientId={clientId} intake={data} />
      )}
    </Panel>
  );
}

/** Resumen de la ficha: fecha de envío y datos clave (el detalle completo, en el panel lateral). */
export function OnboardingIntakeSummary({
  clientId,
  canEdit,
}: {
  clientId: string;
  canEdit: boolean;
}) {
  const intake = useClientIntake(clientId, canEdit);
  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">Solo los editores pueden ver estos datos.</p>
    );
  }
  if (intake.isLoading) return <ListSkeleton rows={2} label="Cargando onboarding" />;
  if (intake.error) {
    return (
      <ErrorState
        message={intake.error.message}
        onRetry={() => void intake.refetch()}
        retrying={intake.isFetching}
      />
    );
  }
  const data = intake.data;
  if (!data) {
    return (
      <EmptyState
        size="compact"
        title="Aún no envía el formulario"
        description="Comparte el link de onboarding para que el cliente complete sus datos."
      />
    );
  }
  return (
    <FactGrid
      facts={[
        { label: "Recibido", value: formatDate(data.submitted_at) },
        { label: "Razón social", value: data.razon_social || "—" },
        { label: "Contacto", value: data.contacto_nombre || "—" },
        { label: "Email", value: data.contacto_email || data.email_facturacion || "—" },
      ]}
    />
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-0.5 sm:grid-cols-3 sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line break-words text-sm text-foreground sm:col-span-2">
        {value}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function IntakeDetails({ clientId, intake }: { clientId: string; intake: Intake }) {
  const links = parseLinks(intake.links_redes);
  const accesses = parseAccesses(intake.accesos_pendientes);
  return (
    <div className="space-y-5">
      <Section title="Facturación y contacto">
        <dl className="space-y-2">
          <Row label="Razón social" value={intake.razon_social} />
          <Row label="RUT" value={intake.rut} />
          <Row label="Giro" value={intake.giro} />
          <Row label="Dirección" value={intake.direccion} />
          <Row label="Email facturación" value={intake.email_facturacion} />
          <Row label="Contacto" value={intake.contacto_nombre} />
          <Row label="Teléfono" value={intake.contacto_telefono} />
          <Row label="Email contacto" value={intake.contacto_email} />
        </dl>
      </Section>

      <Section title="Negocio">
        <dl className="space-y-2">
          <Row label="Descripción" value={intake.descripcion} />
          <Row label="Público objetivo" value={intake.publico_objetivo} />
          <Row label="Competencia" value={intake.competencia} />
          <Row label="Estilo" value={intake.estilo} />
          <Row label="Colores" value={intake.colores.length ? intake.colores.join(", ") : null} />
        </dl>
      </Section>

      {links.length > 0 && (
        <Section title="Redes">
          <ul className="space-y-1.5">
            {links.map(([network, value]) => {
              const href = safeExternalHref(network, value);
              const label = LINK_LABELS[network as LinkKey] ?? network;
              return (
                <li key={network} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                    >
                      {value} <ExternalLink aria-hidden className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="break-all text-foreground">{value}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {accesses.length > 0 && (
        <Section title="Accesos">
          <ul className="space-y-2">
            {accesses.map((a, i) => (
              <li
                key={`${a.servicio}-${i}`}
                className="flex flex-wrap items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-foreground">{a.servicio}</p>
                  {a.nota && <p className="break-words text-xs text-muted-foreground">{a.nota}</p>}
                </div>
                <StatusBadge
                  status={a.estado}
                  tone={ACCESS_TONE[a.estado] ?? "neutral"}
                  label={ACCESS_STATE_LABELS[a.estado as AccessState] ?? a.estado}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {intake.archivos.length > 0 && (
        <Section title={`Archivos (${intake.archivos.length})`}>
          <ul className="space-y-1.5">
            {intake.archivos.map((path) => (
              <FileRow key={path} clientId={clientId} path={path} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

/** URL firmada de lectura: vence a los 5 min en el servidor; se pide de nuevo un poco antes. */
const LINK_TTL_MS = 4 * 60 * 1000;

function FileRow({ clientId, path }: { clientId: string; path: string }) {
  const getUrl = useServerFn(getOnboardingFileUrl);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; until: number } | null>(null);
  const name = displayFileName(path);
  const fresh = link && link.until > Date.now() ? link.url : null;

  const prepare = async () => {
    setBusy(true);
    try {
      const { url } = await getUrl({ data: { clientId, path } });
      setLink({ url, until: Date.now() + LINK_TTL_MS });
    } catch (e) {
      toast.error((e as Error).message || "No se pudo preparar la descarga");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center justify-between gap-2 rounded-app-md border border-border-subtle px-3 py-2">
      <span className="min-w-0 truncate text-sm text-foreground" title={name}>
        {name}
      </span>
      {fresh ? (
        <Button asChild size="sm" variant="outline">
          <a
            href={fresh}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Descargar ${name}`}
          >
            <Download aria-hidden className="mr-1 h-4 w-4" /> Descargar
          </a>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void prepare()}
          disabled={busy}
          aria-label={`Preparar descarga de ${name}`}
        >
          {busy ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <Download aria-hidden className="h-4 w-4" />
          )}
        </Button>
      )}
    </li>
  );
}
