import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  Panel,
  StatusBadge,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { chileToday } from "@/lib/dates/chile";
import { SITE_URL } from "@/lib/site";
import { useAuth } from "@/hooks/use-auth";
import { followupsFor, resolveLink, whatsappHref } from "@/lib/followups/rules";
import {
  isSnoozed,
  readSnoozes,
  withSnooze,
  writeSnoozes,
  type SnoozeMap,
} from "@/lib/followups/snooze";
import { buildMessage } from "@/lib/followups/templates";
import type { Followup, FollowupPriority, FollowupTarget } from "@/lib/followups/types";
import { useFollowups, useRecordProspectContact } from "./followupsData";

const PRIORITY_META: Readonly<Record<FollowupPriority, { label: string; tone: StatusTone }>> = {
  alta: { label: "Alta", tone: "danger" },
  media: { label: "Media", tone: "warning" },
  baja: { label: "Baja", tone: "neutral" },
};

const DEFAULT_LIMIT = 8;

/** Los links de los mensajes siempre apuntan al dominio público (nunca a una preview). */
function origin(): string {
  return SITE_URL;
}

function messageFor(f: Followup): string {
  return buildMessage({ ...f.template, link: resolveLink(f.link, origin()) });
}

async function copyMessage(f: Followup) {
  try {
    await navigator.clipboard.writeText(messageFor(f));
    toast.success("Mensaje copiado");
  } catch (e) {
    console.error("[seguimientos] no se pudo copiar el mensaje", e);
    toast.error("No se pudo copiar. Revisa los permisos del portapapeles.");
  }
}

/**
 * Ocultar hasta mañana (preferencia de este navegador y usuario, ver lib/followups/snooze.ts).
 * `today` se recalcula en cada render (p. ej. tras cada refetch), así que pasada la
 * medianoche de Chile los ítems ocultos vuelven a aparecer sin recargar la página.
 */
function useSnoozes() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const today = chileToday();
  const [map, setMap] = useState<SnoozeMap>({});
  useEffect(() => {
    setMap(userId ? readSnoozes(today, userId) : {});
  }, [today, userId]);
  const snooze = (id: string) => {
    const next = withSnooze(map, id, today);
    setMap(next);
    return userId ? writeSnoozes(next, userId) : false;
  };
  return { isHidden: (id: string) => isSnoozed(map, id, today), snooze };
}

function OpenLink({ target }: { target: FollowupTarget }) {
  const cls = "h-7 text-xs";
  const icon = <ExternalLink aria-hidden className="mr-1 h-3.5 w-3.5" />;
  switch (target.screen) {
    case "prospect":
      return (
        <Button asChild size="sm" variant="ghost" className={cls}>
          <Link to="/pipeline" search={{ prospecto: target.prospectId }}>
            {icon} Abrir ficha
          </Link>
        </Button>
      );
    case "proposal":
      return (
        <Button asChild size="sm" variant="ghost" className={cls}>
          <Link to="/proposals/$proposalId" params={{ proposalId: target.proposalId }}>
            {icon} Abrir propuesta
          </Link>
        </Button>
      );
    case "client_payments":
      return (
        <Button asChild size="sm" variant="ghost" className={cls}>
          <Link to="/clients/$clientId/payments" params={{ clientId: target.clientId }}>
            {icon} Abrir cobros
          </Link>
        </Button>
      );
    case "client":
      return (
        <Button asChild size="sm" variant="ghost" className={cls}>
          <Link to="/clients/$clientId" params={{ clientId: target.clientId }}>
            {icon} Abrir ficha
          </Link>
        </Button>
      );
  }
}

function FollowupRow({
  item,
  showOpen,
  onDone,
  busy,
}: {
  item: Followup;
  showOpen: boolean;
  onDone: (f: Followup) => void;
  busy: boolean;
}) {
  const wa = item.whatsappPhone ? whatsappHref(item.whatsappPhone, messageFor(item)) : null;
  const priority = PRIORITY_META[item.priority];
  return (
    <li className="flex flex-col gap-2 border-b border-border-subtle py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={item.priority}
            label={`Prioridad ${priority.label.toLowerCase()}`}
            tone={priority.tone}
          />
          <span className="truncate text-sm font-medium text-foreground">{item.businessName}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1 sm:shrink-0 sm:justify-end">
        {showOpen && <OpenLink target={item.target} />}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => void copyMessage(item)}
        >
          <Copy aria-hidden className="mr-1 h-3.5 w-3.5" /> Copiar mensaje
        </Button>
        {wa && (
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden className="mr-1 h-3.5 w-3.5" /> Abrir WhatsApp
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => onDone(item)}
        >
          <Check aria-hidden className="mr-1 h-3.5 w-3.5" /> Marcar como hecho
        </Button>
      </div>
    </li>
  );
}

export interface FollowupsPanelProps {
  /** Sin scope: todos (pantalla "Hoy"). Con scope: solo los de ese cliente/prospecto. */
  scope?: { clientId?: string | null; prospectId?: string | null };
  limit?: number;
  /** En la ficha del prospecto no tiene sentido "Abrir ficha" del mismo prospecto. */
  hideOpenForProspect?: boolean;
  /** En una ficha sin seguimientos se oculta el panel completo. */
  hideWhenEmpty?: boolean;
  /**
   * Se llama tras registrar el contacto con un prospecto, con el instante guardado.
   * La ficha lo usa para actualizar su formulario y que "Guardar" no pise el valor nuevo.
   */
  onProspectContactRecorded?: (prospectId: string, contactedAt: string) => void;
}

/** Lista priorizada de seguimientos con acciones en 1 clic. */
export function FollowupsPanel({
  scope,
  limit = DEFAULT_LIMIT,
  hideOpenForProspect,
  hideWhenEmpty,
  onProspectContactRecorded,
}: FollowupsPanelProps) {
  const query = useFollowups();
  const record = useRecordProspectContact();
  const { isHidden, snooze } = useSnoozes();
  const [showAll, setShowAll] = useState(false);

  const all = query.data ?? [];
  const visible = (scope ? followupsFor(all, scope) : all).filter((f) => !isHidden(f.id));

  const onDone = (f: Followup) => {
    if (f.recordsProspectContact && f.prospectId) {
      record.mutate(f.prospectId, {
        onSuccess: (contactedAt, prospectId) => {
          onProspectContactRecorded?.(prospectId, contactedAt);
          toast.success(`Contacto registrado con ${f.businessName}`);
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "No se pudo registrar el contacto"),
      });
      return;
    }
    const saved = snooze(f.id);
    if (saved) toast.success("Oculto hasta mañana en este navegador");
    else toast.warning("Oculto por ahora; este navegador no permite recordarlo hasta mañana.");
  };

  if (hideWhenEmpty && query.isSuccess && visible.length === 0) return null;

  const shown = showAll ? visible : visible.slice(0, limit);
  return (
    <Panel
      icon={Send}
      title="Seguimientos sugeridos"
      description="Qué contactar hoy para que nada se enfríe. Tú revisas y envías."
      actions={
        visible.length > limit ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Ver menos" : `Ver todos (${visible.length})`}
          </Button>
        ) : undefined
      }
    >
      {query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data === undefined ? (
        <ListSkeleton rows={3} label="Cargando seguimientos" />
      ) : visible.length === 0 ? (
        <EmptyState
          size="compact"
          icon={Send}
          title="Todo al día."
          description="No hay seguimientos pendientes por ahora."
        />
      ) : (
        <ul className="-my-3">
          {shown.map((f) => (
            <FollowupRow
              key={f.id}
              item={f}
              showOpen={!(hideOpenForProspect && f.target.screen === "prospect")}
              onDone={onDone}
              busy={record.isPending && record.variables === f.prospectId}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
