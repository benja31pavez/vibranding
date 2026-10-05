import { AlertTriangle, CalendarDays, CheckCircle2, Circle, Timer } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  STAGE_STATUS_LABELS,
  type MemberSummary,
  type StageKey,
  type StageStatus,
  type StageSummary,
} from "@/lib/delivery/planStages";
import { TEAM } from "@/lib/delivery/team";
import { formatShortDate } from "./planFormat";
import { FolderButton, OwnerAvatar } from "./StageFolder";
import { StageMenu, type StageMenuActions } from "./StageMenu";
import { MEMBER_HUE, STAGE_HUE } from "./stagePalette";
import { useEdgeFade } from "./useEdgeFade";

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

/** "⋯" de la etapa: esquina inferior derecha, en la línea de la fecha de entrega. */
const MENU_POSITION = "absolute bottom-1.5 right-1.5 z-10";
/** En la carpeta de una persona el "⋯" va arriba a la derecha del cuerpo. */
const MEMBER_MENU_POSITION = "absolute right-2 top-[30px] z-10";

function DueLine({
  dueDate,
  late,
  emptyLabel,
  prefix = "",
}: {
  dueDate: string | null;
  late: boolean;
  emptyLabel: string;
  prefix?: string;
}) {
  const Icon = late ? AlertTriangle : CalendarDays;
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 text-[11px] tabular-nums",
        late ? "font-semibold text-danger-strong" : "text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {dueDate ? `${prefix}${formatShortDate(dueDate)}` : emptyLabel}
        {late && <span className="hidden @[180px]:inline"> · atrasada</span>}
      </span>
    </span>
  );
}

export interface StageTrackProps {
  stages: readonly StageSummary[];
  selected: StageKey | null;
  onSelect: (key: StageKey | null) => void;
  menu: StageMenuActions;
}

/**
 * Recorrido de las etapas del plan como carpetas: responsable con su anillo de
 * avance y pendientes, estado y fecha de entrega. Un clic filtra las tareas; el
 * "⋯" de cada carpeta edita la fecha de entrega de la etapa. Si no caben en una
 * fila, la fila hace scroll horizontal (con snap) sin mover la página.
 */
export function StageTrack({ stages, selected, onSelect, menu }: StageTrackProps) {
  const { ref, fadeStart, fadeEnd } = useEdgeFade<HTMLOListElement>(stages.length);
  return (
    <nav aria-label="Etapas del plan">
      <ol
        ref={ref}
        data-fade-start={fadeStart}
        data-fade-end={fadeEnd}
        className="plan-folder-row -mx-1 flex snap-x snap-mandatory scroll-px-1 gap-2.5 overflow-x-auto px-1 pb-1.5 pt-1"
      >
        {stages.map((stage, i) => (
          <li
            key={stage.key}
            className="plan-folder-item relative min-w-[128px] flex-1 basis-0 snap-start"
          >
            <StageFolder
              stage={stage}
              index={i}
              active={selected === stage.key}
              onClick={() => onSelect(selected === stage.key ? null : stage.key)}
            />
            <StageMenu
              {...menu}
              stages={[stage]}
              label={`Fecha de entrega de ${stage.label}`}
              className={MENU_POSITION}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StageFolder({
  stage,
  index,
  active,
  onClick,
}: {
  stage: StageSummary;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const StatusIcon = STATUS_ICONS[stage.status];
  const owner = TEAM[stage.owner];
  const pending = stage.total - stage.done;
  return (
    <FolderButton
      hue={STAGE_HUE[stage.key]}
      label={stage.label}
      pressed={active}
      onClick={onClick}
      title={`${stage.label} · ${owner.name}\n${stage.detail}`}
      ariaLabel={`${index + 1}. ${stage.label}, responsable ${owner.name}: ${
        STAGE_STATUS_LABELS[stage.status]
      }, ${stage.done} de ${stage.total} tareas listas, ${pending} pendientes${
        stage.dueDate ? `, entrega ${formatShortDate(stage.dueDate)}` : ""
      }${stage.late ? ", atrasada" : ""}`}
      showIcon={false}
      bodyClassName="@container gap-2 px-2.5 pb-2 pt-2.5"
    >
      <span className="flex items-center gap-2.5">
        <OwnerAvatar
          member={stage.owner}
          pct={stage.pct}
          done={stage.status === "done"}
          pending={pending}
          late={stage.late}
          size={42}
        />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1">
            <span className="plan-folder__ink text-lg font-bold leading-none tabular-nums">
              {stage.pct}
              <span className="text-[11px] font-semibold">%</span>
            </span>
            <StatusIcon
              aria-hidden
              className={cn("h-3.5 w-3.5 shrink-0", STATUS_TONE[stage.status])}
            />
          </span>
          <span className="truncate text-[11px] leading-none tabular-nums text-muted-foreground">
            {stage.done}/{stage.total}
            <span className="hidden @[180px]:inline">
              {" · "}
              {STAGE_STATUS_LABELS[stage.status]}
            </span>
          </span>
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-2 pr-6">
        <DueLine dueDate={stage.dueDate} late={stage.late} emptyLabel="Sin fecha" />
        <span className="ml-auto hidden truncate text-[11px] text-muted-foreground @[210px]:inline">
          {owner.name}
        </span>
      </span>
    </FolderButton>
  );
}

export interface TeamTrackProps {
  members: readonly MemberSummary[];
  stages: readonly StageSummary[];
  selected: StageKey | null;
  onSelect: (key: StageKey | null) => void;
  menu: StageMenuActions;
}

/** Vista de Mantención: una carpeta por persona; su "⋯" edita las fechas de sus etapas. */
export function TeamTrack({ members, stages, selected, onSelect, menu }: TeamTrackProps) {
  return (
    <nav aria-label="Equipo del plan">
      <ul className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
        {members.map((m) => {
          const member = TEAM[m.owner];
          const own = stages.filter((s) => m.stages.includes(s.key));
          const target = own[0]?.key ?? null;
          const active = own.some((s) => s.key === selected);
          const pending = m.total - m.done;
          return (
            <li key={m.owner} className="plan-folder-item relative min-w-0">
              <FolderButton
                hue={MEMBER_HUE[m.owner]}
                label={member.name}
                tabExtra={<span className="truncate font-medium opacity-75">· {member.role}</span>}
                pressed={active}
                onClick={() => onSelect(active ? null : target)}
                ariaLabel={`${member.name}, ${member.role}: ${m.done} de ${m.total} tareas listas, ${pending} pendientes${
                  m.dueDate ? `, próxima entrega ${formatShortDate(m.dueDate)}` : ""
                }${m.late ? ", con atrasos" : ""}`}
                bodyClassName="@container flex-row items-center gap-4 px-4 pb-3 pt-3"
              >
                <OwnerAvatar
                  member={m.owner}
                  pct={m.pct}
                  done={m.total > 0 && m.pct === 100}
                  pending={pending}
                  late={m.late}
                  size={56}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1 pr-5">
                  <span className="flex items-baseline gap-2">
                    <span className="plan-folder__ink text-xl font-bold leading-none tabular-nums">
                      {m.pct}
                      <span className="text-xs font-semibold">%</span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {m.done}/{m.total} tareas listas
                    </span>
                  </span>
                  <span className="truncate text-xs font-medium text-foreground/80">
                    {own.map((s) => s.label).join(" · ")}
                  </span>
                  <DueLine
                    dueDate={m.dueDate}
                    late={m.late}
                    emptyLabel="Sin fecha de entrega"
                    prefix="Próxima entrega "
                  />
                </span>
              </FolderButton>
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
