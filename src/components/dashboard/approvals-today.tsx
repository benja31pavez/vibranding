import { Link } from "@tanstack/react-router";
import { ArrowRight, Inbox } from "lucide-react";
import { EmptyState, Panel } from "@/components/app";
import { BlockState } from "./block-state";
import {
  APPROVAL_KINDS,
  formatShortDate,
  internalPath,
  useApprovalsSummary,
  useClientIndex,
} from "./queries";

/** /approvals la crea otra rama; se enlaza sin tipar para no romper el árbol de rutas. */
const APPROVALS_PATH = internalPath("/approvals");

const KIND_LABEL: Readonly<Record<string, string>> = {
  entregable: "Entregable",
  post_instagram: "Post",
  propuesta: "Propuesta",
};

/** Resumen de la cola de aprobación: conteo por tipo + 5 más recientes. */
export function ApprovalsToday() {
  const query = useApprovalsSummary();
  const clients = useClientIndex();
  const total = query.data?.total;

  return (
    <Panel
      className="min-w-0"
      icon={Inbox}
      title={total ? `Por aprobar hoy (${total})` : "Por aprobar hoy"}
      actions={
        APPROVALS_PATH && (
          <Link
            to={APPROVALS_PATH}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver cola <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        )
      }
    >
      <BlockState query={query} loadingLabel="Cargando aprobaciones">
        {(data) =>
          data.total === 0 ? (
            <EmptyState
              size="compact"
              className="py-3"
              icon={Inbox}
              title="Nada esperando tu aprobación."
              description="Todo al día por ahora."
            />
          ) : (
            <div className="space-y-3">
              <ul className="flex flex-wrap gap-2">
                {APPROVAL_KINDS.map((k) => (
                  <li
                    key={k.key}
                    className="inline-flex items-baseline gap-1.5 rounded-app-md bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {data.countByKind[k.key] ?? 0}
                    </span>
                    {k.label}
                  </li>
                ))}
              </ul>
              <ul className="divide-y divide-border-subtle">
                {data.recent.map((item) => {
                  const to = internalPath(item.url_hint);
                  const client = item.client_id
                    ? clients.data?.nameById.get(item.client_id)
                    : undefined;
                  const kind = KIND_LABEL[item.kind] ?? item.kind;
                  return (
                    <li key={item.key} className="flex items-baseline gap-3 py-2 text-sm last:pb-0">
                      <div className="min-w-0 flex-1">
                        {to ? (
                          <Link to={to} className="block truncate font-medium hover:underline">
                            {item.title}
                          </Link>
                        ) : (
                          <span className="block truncate font-medium">{item.title}</span>
                        )}
                        <span className="block truncate text-xs text-muted-foreground">
                          {client ? `${kind} · ${client}` : kind}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatShortDate(item.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        }
      </BlockState>
    </Panel>
  );
}
