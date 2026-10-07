import { useMemo, useState, type ReactNode } from "react";
import { Check, Flag, LayoutList, ListChecks, Target } from "lucide-react";
import { FitPage, PageHeader, Panel, StatusBadge, type StatusTone } from "@/components/app";
import { chileToday } from "@/lib/dates/chile";
import {
  BOARD_COLUMNS,
  BOARD_COLUMN_LABELS,
  PLAN_STATUS_LABELS,
  TRACK_STATUS_LABELS,
  boardColumn,
  resolvePlan,
  summarizePlan,
  summarizeStages,
  taskStageKey,
  trackStatus,
  type BoardColumn,
  type PlanStatus,
  type StageKey,
  type StageSummary,
  type TrackStatus,
} from "@/lib/delivery/planStages";
import { TEAM, initials } from "@/lib/delivery/team";
import {
  objectiveProgress,
  type PanelObjective,
  type PanelPlan,
  type PanelTask,
} from "@/lib/client-panel/model";
import { cn } from "@/lib/utils";
import { PanelSectionState } from "./PanelSectionState";
import { usePanelPlan } from "./usePanelData";

const TRACK_TONE: Readonly<Record<TrackStatus, StatusTone>> = {
  pending: "neutral",
  active: "info",
  done: "success",
  late: "danger",
};

const PLAN_TONE: Readonly<Record<PlanStatus, StatusTone>> = {
  not_started: "neutral",
  active: "info",
  on_track: "success",
  late: "danger",
};

const COLUMN_TONE: Readonly<Record<BoardColumn, string>> = {
  todo: "bg-neutral-strong",
  doing: "bg-info",
  late: "bg-danger",
  done: "bg-success",
};

const PILL = "px-1.5 py-px text-[11px] leading-4";

/** "2026-10-12" → "12 oct". */
function shortDate(ymd: string | null): string {
  if (!ymd) return "";
  const date = new Date(`${ymd.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
}

function formatValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value);
}

/** Tarea con el marcador como "description" (lo único que planStages lee de ahí). */
function stageTask(t: PanelTask) {
  return { ...t, description: t.marker };
}

/** Plan del cliente en solo lectura: etapas, objetivos con avance y tareas por estado. */
export function PlanPage() {
  const query = usePanelPlan();
  const planLabel =
    query.data?.status === "ok"
      ? resolvePlan(query.data.data.planKey, query.data.data.addons).label
      : null;
  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Plan"
          actions={
            planLabel ? (
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-1">
                {planLabel}
              </span>
            ) : null
          }
        />
      }
      contentClassName="flex flex-col gap-3"
    >
      <PanelSectionState query={query} title="No pudimos cargar tu plan">
        {(plan) => <PlanBoard plan={plan} />}
      </PanelSectionState>
    </FitPage>
  );
}

function PlanBoard({ plan: data }: { plan: PanelPlan }) {
  const today = chileToday();
  const [selected, setSelected] = useState<StageKey | null>(null);
  const plan = useMemo(() => resolvePlan(data.planKey, data.addons), [data]);
  const keys = useMemo(() => plan.stages.map((s) => s.key), [plan]);
  const tasks = useMemo(() => data.tasks.map(stageTask), [data.tasks]);
  const stages = useMemo(
    () => summarizeStages({ plan, rows: data.stages, tasks, today }),
    [plan, data.stages, tasks, today],
  );
  const active = selected && keys.includes(selected) ? selected : null;
  const visible = active ? tasks.filter((t) => taskStageKey(t, keys) === active) : tasks;
  const activeStage = active ? stages.find((s) => s.key === active) : null;

  return (
    <>
      <StageTrack stages={stages} selected={active} onSelect={setSelected} />
      <div className="grid grid-cols-1 gap-3 md:min-h-0 md:flex-1 md:grid-cols-[minmax(240px,1fr)_minmax(0,2.6fr)] md:grid-rows-[minmax(0,1fr)]">
        <Panel title="Objetivos" icon={Target} fill bodyClassName="md:overflow-y-auto">
          <ObjectiveList objectives={data.objectives} />
        </Panel>
        <Panel
          title={activeStage ? `Tareas · ${activeStage.label}` : "Tareas"}
          icon={ListChecks}
          actions={
            data.truncated ? (
              <span className="text-xs text-muted-foreground">Se muestran las más recientes</span>
            ) : undefined
          }
          fill
          bodyClassName="md:min-h-0 md:overflow-hidden"
        >
          <TaskColumns tasks={visible} today={today} />
        </Panel>
      </div>
    </>
  );
}

// ── Etapas ─────────────────────────────────────────────────────────────────

function TeamAvatar({ stage }: { stage: StageSummary }) {
  const member = TEAM[stage.owner];
  return (
    <span
      title={`${member.name}, ${member.role}`}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-foreground/80 ring-1 ring-border-subtle"
    >
      <span aria-hidden>{initials(member.name)}</span>
      <span className="sr-only">Responsable: {member.name}</span>
    </span>
  );
}

function TrackButton({
  pressed,
  onClick,
  media,
  title,
  pill,
  meta,
  late,
}: {
  pressed: boolean;
  onClick: () => void;
  media: ReactNode;
  title: string;
  pill: ReactNode;
  meta: string;
  late?: boolean;
}) {
  return (
    <li className="flex min-w-[124px] flex-1 basis-0 snap-start">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={pressed}
        title={title}
        className={cn(
          "flex w-full flex-col items-start gap-1.5 rounded-app-md px-2.5 py-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          pressed ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/25" : "hover:bg-muted/60",
        )}
      >
        <span
          className={cn(
            "line-clamp-2 min-h-8 text-[13px] font-semibold leading-4",
            pressed ? "text-primary" : "text-foreground",
          )}
        >
          {title}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {media}
          {pill}
        </span>
        {meta && (
          <span
            className={cn(
              "text-[11px] leading-4 tabular-nums text-muted-foreground",
              late && "font-semibold text-danger-strong",
            )}
          >
            {meta}
          </span>
        )}
      </button>
    </li>
  );
}

function StageTrack({
  stages,
  selected,
  onSelect,
}: {
  stages: readonly StageSummary[];
  selected: StageKey | null;
  onSelect: (key: StageKey | null) => void;
}) {
  const summary = summarizePlan(stages);
  return (
    <nav
      aria-label="Etapas del plan"
      className="shrink-0 rounded-app-lg border border-border-subtle bg-surface shadow-app-xs"
    >
      <ol className="flex snap-x snap-mandatory gap-1 overflow-x-auto p-1.5 [scrollbar-width:thin]">
        <TrackButton
          pressed={selected === null}
          onClick={() => onSelect(null)}
          media={
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border-subtle">
              <LayoutList aria-hidden className="h-3.5 w-3.5" />
            </span>
          }
          title="General"
          pill={
            <StatusBadge
              status={summary.status}
              label={PLAN_STATUS_LABELS[summary.status]}
              tone={PLAN_TONE[summary.status]}
              className={PILL}
            />
          }
          meta={`${summary.pct}%`}
        />
        {stages.map((s) => {
          const status = trackStatus(s.status, s.late);
          return (
            <TrackButton
              key={s.key}
              pressed={selected === s.key}
              onClick={() => onSelect(selected === s.key ? null : s.key)}
              media={<TeamAvatar stage={s} />}
              title={s.label}
              pill={
                <StatusBadge
                  status={status}
                  label={TRACK_STATUS_LABELS[status]}
                  tone={TRACK_TONE[status]}
                  className={PILL}
                />
              }
              meta={s.dueDate ? `Entrega ${shortDate(s.dueDate)}` : ""}
              late={s.late}
            />
          );
        })}
      </ol>
    </nav>
  );
}

// ── Objetivos ──────────────────────────────────────────────────────────────

function ObjectiveList({ objectives }: { objectives: readonly PanelObjective[] }) {
  if (objectives.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay objetivos.</p>;
  }
  return (
    <ul className="space-y-3.5">
      {objectives.map((o) => {
        const pct = objectiveProgress(o);
        const done = o.status === "done";
        return (
          <li key={o.id} className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-medium leading-snug">{o.title}</span>
              {done ? (
                <Check aria-label="Cumplido" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : pct !== null ? (
                <span className="shrink-0 text-xs font-semibold tabular-nums">{pct}%</span>
              ) : null}
            </div>
            {pct !== null && (
              <>
                <div
                  role="progressbar"
                  aria-label={`Avance de ${o.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-gradient-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatValue(o.current_value)} de {formatValue(o.target_value)}
                  {o.unit ? ` ${o.unit}` : ""}
                  {o.due_date ? ` · ${shortDate(o.due_date)}` : ""}
                </p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Tareas ─────────────────────────────────────────────────────────────────

function TaskColumns({ tasks, today }: { tasks: readonly PanelTask[]; today: string }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay tareas en esta etapa.</p>;
  }
  const byColumn = (col: BoardColumn) => tasks.filter((t) => boardColumn(t, today) === col);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:h-full md:grid-cols-4 md:grid-rows-[minmax(0,1fr)]">
      {BOARD_COLUMNS.map((col) => {
        const list = byColumn(col);
        return (
          <section
            key={col}
            aria-label={BOARD_COLUMN_LABELS[col]}
            className="flex min-h-0 flex-col rounded-app-md bg-surface-2 p-2"
          >
            <h3 className="flex shrink-0 items-center gap-1.5 px-1 pb-2 text-xs font-semibold text-muted-foreground">
              <span aria-hidden className={cn("h-2 w-2 rounded-full", COLUMN_TONE[col])} />
              {BOARD_COLUMN_LABELS[col]}
              <span className="tabular-nums">{list.length}</span>
            </h3>
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {list.map((t) => (
                <TaskCard key={t.id} task={t} late={col === "late"} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({ task, late }: { task: PanelTask; late: boolean }) {
  return (
    <li className="rounded-app-md border border-border-subtle bg-surface px-2.5 py-2 shadow-app-xs">
      <p className="text-[13px] leading-snug">{task.title}</p>
      {(task.due_date || task.approved_at) && (
        <p className="mt-1 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          {task.due_date && (
            <span className={cn(late && "font-semibold text-danger-strong")}>
              <Flag aria-hidden className="mr-1 inline h-3 w-3" />
              {shortDate(task.due_date)}
            </span>
          )}
          {task.approved_at && (
            <span className="text-success-strong">
              <Check aria-hidden className="mr-0.5 inline h-3 w-3" />
              Aprobada
            </span>
          )}
        </p>
      )}
    </li>
  );
}
