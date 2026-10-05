import type { CSSProperties, ReactNode } from "react";
import { Folder, FolderOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TEAM, initials, type TeamMemberKey } from "@/lib/delivery/team";

/** Foto del integrante del equipo o sus iniciales mientras no haya foto. */
export function TeamAvatar({
  member,
  className,
  style,
}: {
  member: TeamMemberKey;
  className?: string;
  style?: CSSProperties;
}) {
  const m = TEAM[member];
  return (
    <Avatar className={cn("h-7 w-7", className)} style={style}>
      {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" className="object-cover" />}
      <AvatarFallback className="bg-surface text-[13px] font-bold text-[var(--f-ink,var(--primary))]">
        {initials(m.name)}
      </AvatarFallback>
    </Avatar>
  );
}

const RING_STROKE = 3;

/**
 * Avatar grande del responsable con un anillo de avance (0–100) alrededor y,
 * debajo, la burbuja con sus tareas pendientes.
 */
export function OwnerAvatar({
  member,
  pct,
  done,
  pending,
  late,
  size = 44,
}: {
  member: TeamMemberKey;
  pct: number;
  done: boolean;
  pending: number;
  late: boolean;
  size?: number;
}) {
  const r = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          style={{ stroke: "var(--f-track)" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(done ? "stroke-success" : "stroke-[var(--f-accent)]")}
        />
      </svg>
      <TeamAvatar
        member={member}
        className="absolute h-auto w-auto shadow-app-xs"
        style={{ inset: RING_STROKE + 1 }}
      />
      <PendingBadge pending={pending} late={late} />
    </span>
  );
}

/** Pendientes del responsable: rojo si hay atraso, azul si hay pendientes, gris "+" si no hay. */
function PendingBadge({ pending, late }: { pending: number; late: boolean }) {
  const tone =
    pending === 0
      ? "bg-muted text-muted-foreground"
      : late
        ? "bg-danger text-danger-foreground"
        : "bg-primary text-primary-foreground";
  return (
    <span
      aria-hidden
      className={cn(
        "absolute -bottom-1.5 left-1/2 grid h-[18px] min-w-[18px] -translate-x-1/2 place-items-center rounded-full px-1 text-[10px] font-bold tabular-nums leading-none ring-2 ring-surface",
        tone,
      )}
    >
      {pending === 0 ? "+" : pending}
    </span>
  );
}

export interface FolderButtonProps {
  hue: number;
  label: string;
  pressed: boolean;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  /** Texto extra de la pestaña (p. ej. el rol de la persona). */
  tabExtra?: ReactNode;
  /** Ícono de carpeta en la pestaña (se omite en filas densas para dar espacio al nombre). */
  showIcon?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}

/** Carpeta clicable: pestaña con el nombre arriba a la izquierda y cuerpo con degradado. */
export function FolderButton({
  hue,
  label,
  pressed,
  onClick,
  ariaLabel,
  title,
  tabExtra,
  showIcon = true,
  bodyClassName,
  children,
}: FolderButtonProps) {
  const Icon = pressed ? FolderOpen : Folder;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={title}
      className="plan-folder"
      style={{ "--fh": hue } as CSSProperties}
    >
      <span className="plan-folder__tab">
        {showIcon && <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
        {tabExtra}
      </span>
      <span className={cn("plan-folder__body", bodyClassName)}>{children}</span>
    </button>
  );
}
