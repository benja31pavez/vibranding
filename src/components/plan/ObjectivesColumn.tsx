import { Plus, Target } from "lucide-react";
import { FitList, Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  OBJECTIVE_HEALTH_LABELS,
  objectiveHealth,
  objectiveProgress,
  type ObjectiveHealth,
} from "@/lib/plan/objectives";
import type { PlanObjective } from "./planQueries";
import { formatNumber, formatShortDate } from "./planFormat";

const HEALTH_TONE: Readonly<Record<ObjectiveHealth, string>> = {
  done: "bg-success-subtle text-success-strong",
  on_track: "bg-info-subtle text-info-strong",
  at_risk: "bg-warning-subtle text-warning-strong",
  late: "bg-danger-subtle text-danger-strong",
  no_target: "bg-muted text-muted-foreground",
};

const BAR_TONE: Readonly<Record<ObjectiveHealth, string>> = {
  done: "bg-success",
  on_track: "bg-info",
  at_risk: "bg-warning",
  late: "bg-danger",
  no_target: "bg-muted-foreground/40",
};

/** Orden: primero lo que necesita atención, después lo que va bien y al final lo logrado. */
const HEALTH_ORDER: Readonly<Record<ObjectiveHealth, number>> = {
  late: 0,
  at_risk: 1,
  on_track: 2,
  no_target: 3,
  done: 4,
};

export interface ObjectivesColumnProps {
  objectives: readonly PlanObjective[] | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  today: string;
  /** Abre el objetivo para editarlo (o eliminarlo). */
  onOpen: (id: string) => void;
  onCreate: () => void;
}

/** Objetivos en tarjetas compactas: meta vs actual, fecha y si va en camino. Un clic lo edita. */
export function ObjectivesColumn({
  objectives,
  loading,
  error,
  onRetry,
  today,
  onOpen,
  onCreate,
}: ObjectivesColumnProps) {
  const rows = [...(objectives ?? [])]
    .map((o) => ({ o, health: objectiveHealth(o, today) }))
    .sort(
      (a, b) =>
        HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] ||
        (a.o.due_date ?? "9999").localeCompare(b.o.due_date ?? "9999"),
    );
  const atRisk = rows.filter((r) => r.health === "at_risk" || r.health === "late").length;

  return (
    <Panel
      fill
      title="Objetivos"
      icon={Target}
      description={
        rows.length > 0
          ? `${rows.length} en total${atRisk > 0 ? ` · ${atRisk} en riesgo` : ""}`
          : undefined
      }
      actions={
        <Button size="sm" className="h-7 px-2 text-xs" onClick={onCreate}>
          <Plus aria-hidden className="mr-1 h-3.5 w-3.5" /> Nuevo objetivo
        </Button>
      }
      bodyClassName="pt-2"
    >
      {error ? (
        <div className="space-y-2 text-sm">
          <p className="text-danger-strong">No pudimos cargar los objetivos: {error.message}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : loading ? (
        <div role="status" aria-busy className="space-y-2">
          <span className="sr-only">Cargando objetivos</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-app-lg border border-dashed border-border-subtle p-4 text-center text-sm text-muted-foreground">
          <p>Aún no hay objetivos para este cliente.</p>
        </div>
      ) : (
        <FitList
          items={rows}
          getKey={(r) => r.o.id}
          label="Objetivos"
          gap={8}
          divided={false}
          renderItem={({ o, health }) => (
            <ObjectiveCard objective={o} health={health} onOpen={() => onOpen(o.id)} />
          )}
        />
      )}
    </Panel>
  );
}

function ObjectiveCard({
  objective: o,
  health,
  onOpen,
}: {
  objective: PlanObjective;
  health: ObjectiveHealth;
  onOpen: () => void;
}) {
  const progress = objectiveProgress(o);
  const unit = o.unit ? ` ${o.unit}` : "";
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Editar objetivo"
      className="block w-full rounded-app-md border border-border-subtle bg-background/60 px-3 py-2 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {o.title}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            HEALTH_TONE[health],
          )}
        >
          {OBJECTIVE_HEALTH_LABELS[health]}
        </span>
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", BAR_TONE[health])}
            style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
          />
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {o.target_value != null ? (
            <>
              <span className="font-medium text-foreground">
                {formatNumber(o.current_value ?? 0)}
              </span>
              {" / "}
              {formatNumber(o.target_value)}
              {unit}
            </>
          ) : (
            "Sin meta numérica"
          )}
        </span>
      </span>
      <span className="mt-1 block text-[11px] text-muted-foreground">
        {o.due_date ? `Fecha límite: ${formatShortDate(o.due_date)}` : "Sin fecha límite"}
      </span>
    </button>
  );
}
