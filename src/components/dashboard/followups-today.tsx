import { Send } from "lucide-react";
import { EmptyState, ErrorState, FitList, ListSkeleton, Panel } from "@/components/app";
import { FollowupRow, useFollowupActions } from "@/components/followups/FollowupsPanel";
import type { Followup } from "@/lib/followups/types";
import { ClientNotesNotice } from "./client-notes";

/**
 * "Para hacer hoy" de Inicio: seguimientos sugeridos (todos los clientes y
 * prospectos). En escritorio muestra los que caben, con paginador y "Ver todos".
 */
export function FollowupsToday() {
  const { query, visible, onDone, onContacted, isBusy } = useFollowupActions({});

  const renderRow = (f: Followup) => (
    <FollowupRow
      item={f}
      showOpen
      onDone={onDone}
      onContacted={onContacted}
      busy={isBusy(f)}
      compact
    />
  );

  return (
    <Panel
      fill
      icon={Send}
      title={
        <span className="flex items-center gap-2">
          Para hacer hoy
          {visible.length > 0 && (
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              {visible.length}
            </span>
          )}
        </span>
      }
      info="Seguimientos sugeridos de clientes y prospectos, de mayor a menor prioridad: a quién contactar para que nada se enfríe."
      bodyClassName="flex flex-col gap-3 pb-3"
    >
      <ClientNotesNotice />
      {query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data === undefined ? (
        <ListSkeleton rows={3} label="Cargando seguimientos" />
      ) : visible.length === 0 ? (
        <EmptyState size="compact" icon={Send} title="Todo al día." />
      ) : (
        <FitList
          items={visible}
          getKey={(f) => f.id}
          renderItem={renderRow}
          label="Seguimientos"
          sheetDescription="Todos los seguimientos sugeridos, de mayor a menor prioridad."
        />
      )}
    </Panel>
  );
}
