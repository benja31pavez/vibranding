import { Link } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  FitList,
  ListSkeleton,
  Money,
  Panel,
  StatusBadge,
  useBarePanel,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  effectiveStatus,
  formatChileDate,
  isProposalStatus,
  PROPOSAL_STATUS_META,
} from "@/lib/proposals/model";
import { ProposalLinkActions } from "./ProposalLinkActions";
import { useRecipientProposals, type ProposalRow } from "./proposalQueries";

export function ProposalStatusBadge({
  status,
  expiresAt,
}: {
  status: string;
  expiresAt: string | null;
}) {
  const effective = effectiveStatus(status, expiresAt);
  const meta = isProposalStatus(effective) ? PROPOSAL_STATUS_META[effective] : undefined;
  return <StatusBadge status={effective} label={meta?.label} tone={meta?.tone} />;
}

function statusHint(p: ProposalRow): string {
  if (p.status === "aceptada")
    return `Aceptada el ${formatChileDate(p.accepted_at)}${p.accepted_name ? ` por ${p.accepted_name}` : ""}`;
  if (p.status === "vista") return `Vista el ${formatChileDate(p.viewed_at)}`;
  if (p.expires_at) return `Vence el ${formatChileDate(p.expires_at)}`;
  return `Creada el ${formatChileDate(p.created_at)}`;
}

type PanelTarget =
  | { clientId: string; prospectId?: undefined }
  | { prospectId: string; clientId?: undefined };

/**
 * Propuestas de un cliente (en su ficha) o de un prospecto (en su Sheet):
 * estado, monto, link y "Marcar enviada".
 */
export function ProposalsPanel({
  canEdit,
  canCreate = true,
  limit,
  ...target
}: PanelTarget & {
  canEdit: boolean;
  /** false oculta "Crear propuesta" (p. ej. prospecto de baja). */ canCreate?: boolean;
  /** Solo las N más nuevas, una fila cada una (resumen de la ficha). */
  limit?: number;
}) {
  const query = useRecipientProposals(
    target.clientId
      ? { kind: "client", id: target.clientId }
      : { kind: "prospect", id: target.prospectId ?? "" },
  );
  const proposals = query.data ?? [];
  const newSearch = target.clientId
    ? { clientId: target.clientId }
    : { prospectId: target.prospectId };

  return (
    <Panel
      title="Propuestas"
      icon={FileText}
      actions={
        canEdit && canCreate ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/proposals/new" search={newSearch}>
              <Plus aria-hidden className="mr-1 h-3.5 w-3.5" />{" "}
              {limit ? "Nueva" : target.clientId ? "Nueva propuesta" : "Crear propuesta"}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <ListSkeleton rows={2} label="Cargando propuestas" />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : proposals.length === 0 ? (
        <EmptyState
          size="compact"
          icon={FileText}
          title="Sin propuestas"
          description="Arma una propuesta con plan, adicionales y vencimiento, y compártela por link."
        />
      ) : limit ? (
        <ul className="divide-y divide-border-subtle">
          {proposals.slice(0, limit).map((p) => (
            <li key={p.id}>
              <ProposalLine proposal={p} />
            </li>
          ))}
        </ul>
      ) : (
        <ProposalList proposals={proposals} canEdit={canEdit} />
      )}
    </Panel>
  );
}

function ProposalRowView({
  proposal: p,
  canEdit,
  stacked = false,
}: {
  proposal: ProposalRow;
  canEdit: boolean;
  /** Columna angosta (ficha): acciones debajo. */
  stacked?: boolean;
}) {
  return (
    <div
      className={
        stacked
          ? "flex flex-col gap-1 py-2"
          : "flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/proposals/$proposalId"
            params={{ proposalId: p.id }}
            className="truncate text-sm font-medium hover:underline"
          >
            {p.title || "Propuesta sin título"}
          </Link>
          <ProposalStatusBadge status={p.status} expiresAt={p.expires_at} />
        </div>
        <p className="text-xs text-muted-foreground">
          <Money amount={p.amount_clp} /> · {statusHint(p)}
        </p>
      </div>
      {canEdit && <ProposalLinkActions proposal={p} />}
    </div>
  );
}

/** Una línea: título, estado y monto (resumen de la ficha). */
function ProposalLine({ proposal: p }: { proposal: ProposalRow }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Link
        to="/proposals/$proposalId"
        params={{ proposalId: p.id }}
        className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
        title={statusHint(p)}
      >
        {p.title || "Propuesta sin título"}
      </Link>
      <ProposalStatusBadge status={p.status} expiresAt={p.expires_at} />
      <Money amount={p.amount_clp} className="shrink-0 text-xs text-muted-foreground" />
    </div>
  );
}

/** Filas antes de medir (SSR) y por página en móvil, dentro de la ficha. */
const FIT_PAGE_SIZE = 4;

/** En la ficha (sección que llena el alto) usa `FitList`; en otros paneles, lista completa. */
function ProposalList({ proposals, canEdit }: { proposals: ProposalRow[]; canEdit: boolean }) {
  const bare = useBarePanel();
  if (bare?.fill) {
    return (
      <FitList
        items={proposals}
        getKey={(p) => p.id}
        label="Propuestas"
        defaultPageSize={FIT_PAGE_SIZE}
        renderItem={(p) => <ProposalRowView proposal={p} canEdit={canEdit} stacked />}
      />
    );
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {proposals.map((p) => (
        <li key={p.id}>
          <ProposalRowView proposal={p} canEdit={canEdit} />
        </li>
      ))}
    </ul>
  );
}
