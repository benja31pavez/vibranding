import type { ReactNode } from "react";
import { StatusBadge, type StatusTone } from "@/components/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  PLAN_STATUS_LABELS,
  TRACK_STATUS_LABELS,
  type PlanStatus,
  type TrackStatus,
} from "@/lib/delivery/planStages";
import { TEAM, initials, type TeamMemberKey } from "@/lib/delivery/team";
import { formatShortDate } from "./planFormat";

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

const PILL_CLS = "px-1.5 py-px text-[11px] leading-4";

/** Pastilla de estado de una etapa o persona (el color solo vive aquí). */
export function TrackPill({ status }: { status: TrackStatus }) {
  return (
    <StatusBadge
      status={status}
      label={TRACK_STATUS_LABELS[status]}
      tone={TRACK_TONE[status]}
      className={PILL_CLS}
    />
  );
}

/** Pastilla del estado general del plan. */
export function PlanPill({ status }: { status: PlanStatus }) {
  return (
    <StatusBadge
      status={status}
      label={PLAN_STATUS_LABELS[status]}
      tone={PLAN_TONE[status]}
      className={PILL_CLS}
    />
  );
}

/** Foto redonda del responsable o sus iniciales mientras no haya foto. */
export function TeamAvatar({ member, className }: { member: TeamMemberKey; className?: string }) {
  const m = TEAM[member];
  return (
    <Avatar className={cn("h-9 w-9 ring-1 ring-border-subtle", className)}>
      {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" className="object-cover" />}
      <AvatarFallback className="bg-muted text-xs font-semibold text-foreground/80">
        {initials(m.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Solo la fecha de entrega ("Entrega 20 oct"), en rojo si está atrasada. Sin fecha → nada. */
export function TrackMeta({
  dueDate,
  late,
  duePrefix = "Entrega",
}: {
  done?: number;
  total?: number;
  dueDate: string | null;
  late: boolean;
  duePrefix?: string;
}) {
  if (!dueDate) return null;
  return (
    <span
      className={cn(
        "truncate text-[11px] leading-4 tabular-nums text-muted-foreground",
        late && "font-semibold text-danger-strong",
      )}
    >
      <span className="hidden @[110px]:inline">{duePrefix} </span>
      {formatShortDate(dueDate)}
    </span>
  );
}

export interface TrackItemProps {
  /** Avatar (foto del responsable) o ícono del ítem. */
  media: ReactNode;
  /** Junto al avatar (p. ej. la barra de avance de "General"). */
  aside?: ReactNode;
  title: string;
  /** Segunda línea opcional bajo el nombre (p. ej. "Todo el plan"). */
  subtitle?: string;
  pill: ReactNode;
  meta: ReactNode;
  pressed: boolean;
  onClick: () => void;
  ariaLabel: string;
  /** Botón "⋯" (se superpone arriba a la derecha; visible al pasar el mouse o con foco). */
  menu?: ReactNode;
  className?: string;
}

/**
 * Ítem del recorrido del plan: avatar, nombre (hasta 2 líneas), pastilla de
 * estado y una línea con avance y fecha. Neutro; seleccionado = fondo suave.
 */
export function TrackItem({
  media,
  aside,
  title,
  subtitle,
  pill,
  meta,
  pressed,
  onClick,
  ariaLabel,
  menu,
  className,
}: TrackItemProps) {
  return (
    <li className={cn("group relative flex min-w-[110px] flex-1 basis-0 snap-start", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={pressed}
        aria-label={ariaLabel}
        title={title}
        className={cn(
          "@container flex w-full rounded-app-md px-3 py-2.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          pressed ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/25" : "hover:bg-muted/60",
        )}
      >
        {/* Angosto: avatar arriba y todo apilado. Ancho (≥240px, p. ej. Mantención): avatar a la izquierda. */}
        <span className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 @[240px]:gap-x-3.5 @[240px]:gap-y-1.5">
          <span
            className={cn(
              "col-start-1 row-start-1 @[240px]:row-span-2",
              aside && "@[240px]:row-span-3",
            )}
          >
            {media}
          </span>
          {aside && (
            <span className="col-start-2 row-start-1 flex min-w-0 @[240px]:row-start-3">
              {aside}
            </span>
          )}
          <span className="col-span-2 row-start-2 flex min-h-8 flex-col justify-start @[240px]:col-span-1 @[240px]:col-start-2 @[240px]:row-start-1 @[240px]:min-h-0">
            <span
              className={cn(
                "line-clamp-2 text-[13px] font-semibold leading-4 text-foreground",
                pressed && "text-primary",
              )}
            >
              {title}
            </span>
            {subtitle && (
              <span className="truncate text-[11px] leading-4 text-muted-foreground">
                {subtitle}
              </span>
            )}
          </span>
          <span className="col-span-2 row-start-3 flex min-w-0 flex-col items-start gap-1 @[240px]:col-span-1 @[240px]:col-start-2 @[240px]:row-start-2 @[240px]:flex-row @[240px]:items-center @[240px]:gap-2">
            {pill}
            {meta}
          </span>
        </span>
      </button>
      {menu && (
        <span
          className={cn(
            "absolute right-1.5 top-1.5 transition-opacity",
            "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100",
            "[@media(hover:none)]:opacity-100",
          )}
        >
          {menu}
        </span>
      )}
    </li>
  );
}
