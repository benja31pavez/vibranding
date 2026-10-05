import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, Money, Panel, StatusBadge } from "@/components/app";
import { usePendingProposals, type PendingProposal } from "./growthQueries";

/** Días sin respuesta desde el envío para marcar una propuesta como "hacer seguimiento". */
const FOLLOW_UP_AFTER_DAYS = 5;
const DAY_MS = 86_400_000;
const DATE = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeZone: "America/Santiago",
});

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / DAY_MS) : null;
}

export function PendingProposalsPanel() {
  const query = usePendingProposals();
  return (
    <Panel
      icon={FileText}
      title="Propuestas esperando respuesta"
      description="Enviadas o vistas, sin aceptar ni rechazar. Las más antiguas primero."
    >
      {query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.isPending ? (
        <ListSkeleton rows={3} label="Cargando propuestas" />
      ) : query.data.length === 0 ? (
        <EmptyState icon={FileText} size="compact" title="No hay propuestas pendientes." />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {query.data.map((p) => (
            <PendingRow key={p.id} proposal={p} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PendingRow({ proposal: p }: { proposal: PendingProposal }) {
  const age = daysSince(p.sent_at);
  const needsFollowUp = !p.cold && age !== null && age >= FOLLOW_UP_AFTER_DAYS;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <Link
          to="/proposals/$proposalId"
          params={{ proposalId: p.id }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {p.recipient}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {p.title ?? "Propuesta"}
          {p.sent_at ? ` · enviada el ${DATE.format(new Date(p.sent_at))}` : ""}
          {age !== null ? ` (hace ${age} día${age === 1 ? "" : "s"})` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {p.cold && <StatusBadge status="frio" label="Prospecto frío" tone="info" />}
        {needsFollowUp && <StatusBadge status="follow" label="Hacer seguimiento" tone="warning" />}
        <StatusBadge
          status={p.status}
          label={p.status === "vista" ? "Vista" : "Enviada"}
          tone={p.status === "vista" ? "warning" : "info"}
        />
        <Money amount={p.amount_clp} className="text-sm font-medium" />
      </div>
    </li>
  );
}
