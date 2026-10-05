import { CheckCircle2, ChevronRight, Circle, Timer } from "lucide-react";
import type { ComponentType } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  STAGE_STATUS_LABELS,
  type MemberSummary,
  type StageKey,
  type StageStatus,
  type StageSummary,
} from "@/lib/delivery/planStages";
import { TEAM, initials, type TeamMemberKey } from "@/lib/delivery/team";
import { formatShortDate } from "./planFormat";
import { StageMenu, type StageMenuActions } from "./StageMenu";

const STATUS_ICONS: Readonly<Record<StageStatus, ComponentType<{ className?: string }>>> = {
  pending: Circle,
  active: Timer,
  done: CheckCircle2,
};

const STATUS_TONE: Readonly<Record<StageStatus, string>> = {
  pending: "text-muted-foreground",
  active: "text-warning-strong",
  done: "text-success-strong",
};

const BAR_TONE: Readonly<Record<StageStatus, string>> = {
  pending: "bg-primary/60",
  active: "bg-warning",
  done: "bg-success",
};

/** Columnas de la grilla según cuántas etapas tiene el plan (2 a 8). */
function gridCols(count: number): string {
  if (count <= 2) return "sm:grid-cols-2";
  if (count === 3) return "sm:grid-cols-3";
  if (count === 4) return "sm:grid-cols-2 lg:grid-cols-4";
  if (count <= 6) return "sm:grid-cols-3 lg:grid-cols-6";
  return "sm:grid-cols-4 xl:grid-cols-8";
}

/** Foto del integrante del equipo o sus iniciales mientras no haya foto. */
export function TeamAvatar({ member, className }: { member: TeamMemberKey; className?: string }) {
  const m = TEAM[member];
  return (
    <Avatar className={cn("h-7 w-7", className)}>
      {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
      <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
        {initials(m.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function ProgressBar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-muted">
      <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
    </span>
  );
}

function DueLabel({
  dueDate,
  late,
  dense = false,
}: {
  dueDate: string | null;
  late: boolean;
  dense?: boolean;
}) {
  const empty = dense ? "Sin fecha" : "Sin fecha de entrega";
  return (
    <span className={cn("tabular-nums", late && "font-medium text-danger-strong")}>
      {dueDate ? `Entrega ${formatShortDate(dueDate)}` : empty}
      {late && " · atrasada"}
    </span>
  );
}

/** Esquina inferior derecha de la tarjeta, alineado con la línea de la fecha de entrega. */
const STAGE_MENU_POSITION = "absolute bottom-1 right-1";
const MEMBER_MENU_POSITION = "absolute bottom-2 right-3";

export interface StageTrackProps {
  stages: readonly StageSummary[];
  selected: StageKey | null;
  onSelect: (key: StageKey | null) => void;
  menu: StageMenuActions;
}

/**
 * Recorrido de las etapas del plan: responsable, avance y fecha. Un clic filtra
 * las tareas; el "⋯" de cada tarjeta edita la fecha de entrega de la etapa.
 */
export function StageTrack({ stages, selected, onSelect, menu }: StageTrackProps) {
  return (
    <nav aria-label="Etapas del plan">
      <ol className={cn("grid grid-cols-2 gap-2", gridCols(stages.length))}>
        {stages.map((stage, i) => (
          <li key={stage.key} className="relative min-w-0">
            <StageChip
              stage={stage}
              dense={stages.length > DENSE_FROM}
              index={i}
              active={selected === stage.key}
              onClick={() => onSelect(selected === stage.key ? null : stage.key)}
            />
            <StageMenu
              {...menu}
              stages={[stage]}
              label={`Fecha de entrega de ${stage.label}`}
              className={STAGE_MENU_POSITION}
            />
            {i < stages.length - 1 && (
              <ChevronRight
                aria-hidden
                className="pointer-events-none absolute -right-2.5 top-1/2 z-10 hidden h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60 lg:block"
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Desde 7 etapas (Crecimiento) la tarjeta se compacta para que quepan en una fila. */
const DENSE_FROM = 6;

function StageChip({
  stage,
  dense,
  index,
  active,
  onClick,
}: {
  stage: StageSummary;
  dense: boolean;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const StatusIcon = STATUS_ICONS[stage.status];
  const owner = TEAM[stage.owner];
  const progress = stage.total > 0 ? `${stage.done}/${stage.total}` : "0/0";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={stage.detail}
      aria-label={`${index + 1}. ${stage.label}, responsable ${owner.name}: ${
        STAGE_STATUS_LABELS[stage.status]
      }, ${stage.done} de ${stage.total} tareas listas${
        stage.dueDate ? `, entrega ${formatShortDate(stage.dueDate)}` : ""
      }${stage.late ? ", atrasada" : ""}`}
      className={cn(
        "flex h-full w-full flex-col gap-1.5 rounded-app-lg border border-border-subtle bg-surface px-3 py-2 text-left shadow-app-xs transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary ring-1 ring-primary",
        stage.late && !active && "border-danger/40",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "font-semibold leading-tight text-foreground",
            dense
              ? "line-clamp-2 min-h-[2lh] hyphens-auto break-words text-xs"
              : "line-clamp-1 text-sm",
          )}
        >
          {stage.label}
        </span>
        <StatusIcon
          aria-hidden
          className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", STATUS_TONE[stage.status])}
        />
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <TeamAvatar member={stage.owner} className="h-5 w-5" />
        <span className="truncate text-[11px] text-muted-foreground">
          {dense ? owner.name : `${owner.name} · ${owner.role}`}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <ProgressBar pct={stage.pct} tone={BAR_TONE[stage.status]} />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {dense ? progress : `${progress} · ${stage.pct}%`}
        </span>
      </span>
      <span className="pr-5 text-[11px] text-muted-foreground">
        <DueLabel dueDate={stage.dueDate} late={stage.late} dense={dense} />
      </span>
    </button>
  );
}

export interface TeamTrackProps {
  members: readonly MemberSummary[];
  stages: readonly StageSummary[];
  selected: StageKey | null;
  onSelect: (key: StageKey | null) => void;
  menu: StageMenuActions;
}

/** Vista de Mantención: una tarjeta por persona; su "⋯" edita las fechas de sus etapas. */
export function TeamTrack({ members, stages, selected, onSelect, menu }: TeamTrackProps) {
  return (
    <nav aria-label="Equipo del plan">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {members.map((m) => {
          const member = TEAM[m.owner];
          const own = stages.filter((s) => m.stages.includes(s.key));
          const target = own[0]?.key ?? null;
          const active = own.some((s) => s.key === selected);
          return (
            <li key={m.owner} className="relative min-w-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : target)}
                aria-label={`${member.name}, ${member.role}: ${m.done} de ${m.total} tareas listas${
                  m.dueDate ? `, próxima entrega ${formatShortDate(m.dueDate)}` : ""
                }${m.late ? ", con atrasos" : ""}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-app-lg border border-border-subtle bg-surface px-4 py-3 text-left shadow-app-xs transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "border-primary ring-1 ring-primary",
                )}
              >
                <TeamAvatar member={m.owner} className="h-11 w-11" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {member.name}{" "}
                      <span className="font-normal text-muted-foreground">· {member.role}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {m.done}/{m.total} · {m.pct}%
                    </span>
                  </span>
                  <ProgressBar pct={m.pct} tone={m.pct === 100 ? "bg-success" : "bg-primary"} />
                  <span className="flex flex-wrap justify-between gap-x-2 pr-5 text-[11px] text-muted-foreground">
                    <span className="truncate">{own.map((s) => s.label).join(" · ")}</span>
                    <DueLabel dueDate={m.dueDate} late={m.late} />
                  </span>
                </span>
              </button>
              <StageMenu
                {...menu}
                stages={own}
                label={`Fechas de entrega de ${member.name}`}
                className={MEMBER_MENU_POSITION}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
