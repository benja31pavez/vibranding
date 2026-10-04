import { Link } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, Money, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { effectiveStatus, formatChileDate, isProposalStatus, PROPOSAL_STATUS_META } from "@/lib/proposals/model";
import { ProposalLinkActions } from "./ProposalLinkActions";
import { useRecipientProposals, type ProposalRow } from "./proposalQueries";

export function ProposalStatusBadge({ status, expiresAt }: { status: string; expiresAt: string | null }) {
  const effective = effectiveStatus(status, expiresAt);
  const meta = isProposalStatus(effective) ? PROPOSAL_STATUS_META[effective] : undefined;
  return <StatusBadge status={effective} label={meta?.label} tone={meta?.tone} />;
}

function statusHint(p: ProposalRow): string {
  if (p.status === "aceptada") return `Aceptada el ${formatChileDate(p.accepted_at)}${p.accepted_name ? ` por ${p.accepted_name}` : ""}`;
  if (p.status === "vista") return `Vista el ${formatChileDate(p.viewed_at)}`;
  if (p.expires_at) return `Vence el ${formatChileDate(p.expires_at)}`;
  return `Creada el ${formatChileDate(p.created_at)}`;
}

type PanelTarget = { clientId: string; prospectId?: undefined } | { prospectId: string; clientId?: undefined };

/**
 * Propuestas de un cliente (en su ficha) o de un prospecto (en su Sheet):
 * estado, monto, link y "Marcar enviada".
 */
export function ProposalsPanel({ canEdit, ...target }: PanelTarget & { canEdit: boolean }) {
  const query = useRecipientProposals(
    target.clientId ? { kind: "client", id: target.clientId } : { kind: "prospect", id: target.prospectId ?? "" },
  );
  const proposals = query.data ?? [];
  const newSearch = target.clientId ? { clientId: target.clientId } : { prospectId: target.prospectId };

  return (
    <Panel
      title="Propuestas"
      icon={FileText}
      actions={
        canEdit ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/proposals/new" search={newSearch}>
              <Plus aria-hidden className="mr-1 h-3.5 w-3.5" /> {target.clientId ? "Nueva propuesta" : "Crear propuesta"}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <ListSkeleton rows={2} label="Cargando propuestas" />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : proposals.length === 0 ? (
        <EmptyState
          size="compact"
          icon={FileText}
          title="Sin propuestas"
          description="Arma una propuesta con plan, adicionales y vencimiento, y compártela por link."
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {proposals.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
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
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
