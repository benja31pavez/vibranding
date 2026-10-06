import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCheck, LayoutTemplate, Plus, Target } from "lucide-react";
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
  /** Objetivo estándar del plan del cliente (se marca con el ícono de plantilla). */
  isTemplate: (objective: PlanObjective) => boolean;
  /** Cliente sin plan: en vez del vacío se invita a asignarlo (en la ficha). */
  noPlanClientId?: string | null;
}

/**
 * Objetivos en tarjetas compactas: barra de avance (actual de meta y %), sí/no
 * (Pendiente / Entregado) o "Meta por definir", con su fecha. Un clic lo edita.
 */
export function ObjectivesColumn({
  objectives,
  loading,
  error,
  onRetry,
  today,
  onOpen,
  onCreate,
  isTemplate,
  noPlanClientId = null,
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
      ) : rows.length === 0 && noPlanClientId ? (
        <AssignPlanCallout clientId={noPlanClientId} />
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
            <ObjectiveCard
              objective={o}
              health={health}
              template={isTemplate(o)}
              onOpen={() => onOpen(o.id)}
            />
          )}
        />
      )}
    </Panel>
  );
}

/** Sin plan: el plan se asigna en Facturación (entorno del cliente); nunca enlaza a la gestión de la agencia. */
function AssignPlanCallout({ clientId }: { clientId: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-app-lg border border-dashed border-border-subtle px-4 py-6 text-center">
      <p className="text-sm font-medium text-foreground">
        Asigna un plan para crear objetivos y tareas
      </p>
      <Button asChild size="sm" variant="outline" className="h-8 text-xs">
        <Link to="/clients/$clientId/facturacion" params={{ clientId }}>
          Ir a Facturación
          <ArrowRight aria-hidden className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

/** Cómo se mide: barra (meta numérica), sí/no (meta 1) o sin meta todavía. */
type ObjectiveKind = "progress" | "yes_no" | "no_target";

function objectiveKind(o: PlanObjective): ObjectiveKind {
  if (o.target_value == null || o.target_value === 0) return "no_target";
  return o.target_value === 1 ? "yes_no" : "progress";
}

interface Chip {
  label: string;
  tone: string;
  delivered?: boolean;
}

/** Chip del objetivo: sí/no usa los estados de las tareas; el resto, la salud del objetivo. */
function objectiveChip(kind: ObjectiveKind, health: ObjectiveHealth): Chip | null {
  if (kind === "yes_no") {
    if (health === "done") return { label: "Entregado", tone: HEALTH_TONE.done, delivered: true };
    if (health === "late") return { label: "Atrasado", tone: HEALTH_TONE.late };
    return { label: "Pendiente", tone: HEALTH_TONE.no_target };
  }
  // "Meta por definir" ya lo dice abajo: sin chip "Sin meta" duplicado.
  if (health === "no_target") return null;
  return { label: OBJECTIVE_HEALTH_LABELS[health], tone: HEALTH_TONE[health] };
}

function ObjectiveCard({
  objective: o,
  health,
  template,
  onOpen,
}: {
  objective: PlanObjective;
  health: ObjectiveHealth;
  template: boolean;
  onOpen: () => void;
}) {
  const kind = objectiveKind(o);
  const chip = objectiveChip(kind, health);
  const percent = Math.round((objectiveProgress(o) ?? 0) * 100);
  const due = o.due_date ? `Fecha límite ${formatShortDate(o.due_date)}` : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Editar objetivo"
      className="block w-full rounded-app-md border border-border-subtle bg-background/60 px-3 py-2 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {template && (
            <span title="Plantilla: objetivo estándar del plan" className="mr-1 inline-block">
              <LayoutTemplate
                aria-hidden
                className="inline h-3 w-3 -translate-y-px text-muted-foreground/70"
              />
              <span className="sr-only">Plantilla: </span>
            </span>
          )}
          {o.title}
        </span>
        {chip && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              chip.tone,
            )}
          >
            {chip.delivered && <CheckCheck aria-hidden className="h-3 w-3" />}
            {chip.label}
          </span>
        )}
      </span>
      {kind === "progress" && o.target_value != null && (
        <span className="mt-1.5 flex items-center gap-2">
          <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-gradient-brand"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
            {percent}%
          </span>
        </span>
      )}
      {(kind !== "yes_no" || due) && (
        <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          {kind === "progress" && o.target_value != null ? (
            <span className="tabular-nums">
              <span className="font-medium text-foreground">
                {formatNumber(o.current_value ?? 0)}
              </span>{" "}
              de {formatNumber(o.target_value)}
              {o.unit ? ` ${o.unit}` : ""}
            </span>
          ) : kind === "no_target" ? (
            <span>Meta por definir</span>
          ) : (
            <span />
          )}
          {due && <span className="shrink-0 tabular-nums">{due}</span>}
        </span>
      )}
    </button>
  );
}
