import type { ReactNode } from "react";
import { LayoutList } from "lucide-react";
import {
  PLAN_STATUS_LABELS,
  TRACK_STATUS_LABELS,
  memberStatus,
  summarizePlan,
  trackStatus,
  type MemberSummary,
  type StageKey,
  type StageSummary,
} from "@/lib/delivery/planStages";
import { TEAM } from "@/lib/delivery/team";
import { formatShortDate } from "./planFormat";
import { StageMenu, type StageMenuActions } from "./StageMenu";
import { PlanPill, TeamAvatar, TrackItem, TrackMeta, TrackPill } from "./TrackItem";

/**
 * Lista neutra del recorrido: "General" (todo el plan) y luego un ítem por
 * etapa o persona. Si no caben, solo esta fila hace scroll horizontal (con snap);
 * la página no se mueve.
 */
function TrackList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="rounded-app-lg border border-border-subtle bg-surface shadow-app-xs"
    >
      <ol className="flex snap-x snap-mandatory scroll-px-1.5 gap-1 overflow-x-auto p-1.5 [scrollbar-width:thin]">
        {children}
      </ol>
    </nav>
  );
}

/** "General": avance de todas las etapas, estado del plan y próxima entrega. */
function GeneralItem({
  stages,
  pressed,
  onClick,
}: {
  stages: readonly StageSummary[];
  pressed: boolean;
  onClick: () => void;
}) {
  const plan = summarizePlan(stages);
  return (
    <TrackItem
      className="after:absolute after:-right-[3px] after:inset-y-2 after:w-px after:bg-border-subtle"
      media={
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border-subtle"
        >
          <LayoutList className="h-4 w-4" />
        </span>
      }
      aside={
        <span
          aria-hidden
          className="flex min-w-0 flex-1 flex-col gap-1 @[240px]:max-w-60 @[240px]:flex-row-reverse @[240px]:items-center @[240px]:gap-2"
        >
          <span className="text-xs font-semibold leading-none tabular-nums text-foreground">
            {plan.pct}%
          </span>
          <span className="h-1 w-full overflow-hidden rounded-full bg-muted @[240px]:flex-1">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${plan.pct}%` }}
            />
          </span>
        </span>
      }
      title="General"
      subtitle="Todo el plan"
      pill={<PlanPill status={plan.status} />}
      meta={
        <TrackMeta
          done={plan.done}
          total={plan.total}
          dueDate={plan.nextDue}
          late={plan.status === "late"}
          duePrefix="Próx."
        />
      }
      pressed={pressed}
      onClick={onClick}
      ariaLabel={`General, todo el plan: ${PLAN_STATUS_LABELS[plan.status]}, ${plan.done} de ${
        plan.total
      } tareas listas${plan.nextDue ? `, próxima entrega ${formatShortDate(plan.nextDue)}` : ""}`}
    />
  );
}

export interface StageTrackProps {
  stages: readonly StageSummary[];
  selected: StageKey | null;
  onSelect: (key: StageKey | null) => void;
  menu: StageMenuActions;
}

/** Etapas del plan: "General" + una por etapa con su responsable, estado y entrega. */
export function StageTrack({ stages, selected, onSelect, menu }: StageTrackProps) {
  return (
    <TrackList label="Etapas del plan">
      <GeneralItem stages={stages} pressed={selected === null} onClick={() => onSelect(null)} />
      {stages.map((stage, i) => {
        const owner = TEAM[stage.owner];
        const status = trackStatus(stage.status, stage.late);
        const active = selected === stage.key;
        return (
          <TrackItem
            key={stage.key}
            media={<TeamAvatar member={stage.owner} />}
            title={stage.label}
            pill={<TrackPill status={status} />}
            meta={
              <TrackMeta
                done={stage.done}
                total={stage.total}
                dueDate={stage.dueDate}
                late={stage.late}
              />
            }
            pressed={active}
            onClick={() => onSelect(active ? null : stage.key)}
            ariaLabel={`${i + 1}. ${stage.label}, responsable ${owner.name}: ${
              TRACK_STATUS_LABELS[status]
            }, ${stage.done} de ${stage.total} tareas listas${
              stage.dueDate ? `, entrega ${formatShortDate(stage.dueDate)}` : ", sin fecha"
            }`}
            menu={
              <StageMenu {...menu} stages={[stage]} label={`Fecha de entrega de ${stage.label}`} />
            }
          />
        );
      })}
    </TrackList>
  );
}

export interface TeamTrackProps {
  members: readonly MemberSummary[];
  stages: readonly StageSummary[];
  selected: StageKey | null;
  onSelect: (key: StageKey | null) => void;
  menu: StageMenuActions;
}

/** Vista de Mantención: "General" + una por persona; su "⋯" edita las fechas de sus etapas. */
export function TeamTrack({ members, stages, selected, onSelect, menu }: TeamTrackProps) {
  return (
    <TrackList label="Equipo del plan">
      <GeneralItem stages={stages} pressed={selected === null} onClick={() => onSelect(null)} />
      {members.map((m) => {
        const member = TEAM[m.owner];
        const own = stages.filter((s) => m.stages.includes(s.key));
        const target = own[0]?.key ?? null;
        const active = own.some((s) => s.key === selected);
        const status = memberStatus(own);
        const work = own.map((s) => s.label).join(" · ");
        return (
          <TrackItem
            key={m.owner}
            media={<TeamAvatar member={m.owner} />}
            title={member.name}
            subtitle={work}
            pill={<TrackPill status={status} />}
            meta={<TrackMeta done={m.done} total={m.total} dueDate={m.dueDate} late={m.late} />}
            pressed={active}
            onClick={() => onSelect(active ? null : target)}
            ariaLabel={`${member.name}, ${work}: ${TRACK_STATUS_LABELS[status]}, ${m.done} de ${
              m.total
            } tareas listas${m.dueDate ? `, próxima entrega ${formatShortDate(m.dueDate)}` : ""}`}
            menu={
              <StageMenu {...menu} stages={own} label={`Fechas de entrega de ${member.name}`} />
            }
          />
        );
      })}
    </TrackList>
  );
}
