import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

interface StatusDef {
  label: string;
  tone: StatusTone;
}

/**
 * Estados conocidos de la plataforma → etiqueta en español + tono semántico.
 * Claves en inglés tal como vienen de la base de datos.
 */
export const STATUS_MAP: Readonly<Record<string, StatusDef>> = {
  // Pagos
  pending: { label: "Pendiente", tone: "warning" },
  paid: { label: "Pagado", tone: "success" },
  overdue: { label: "Vencido", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  // Contratos
  draft: { label: "Borrador", tone: "neutral" },
  sent: { label: "Enviado", tone: "info" },
  signed: { label: "Firmado", tone: "success" },
  // Etapas / entregables
  in_progress: { label: "En curso", tone: "info" },
  in_review: { label: "En revisión", tone: "warning" },
  done: { label: "Listo", tone: "success" },
  // Aprobaciones
  approval: { label: "Aprobado", tone: "success" },
  approved: { label: "Aprobado", tone: "success" },
  change_request: { label: "Cambios", tone: "warning" },
  changes_requested: { label: "Cambios", tone: "warning" },
  comment: { label: "Comentario", tone: "neutral" },
  rejected: { label: "Rechazado", tone: "danger" },
  // Clientes / publicaciones
  active: { label: "Activo", tone: "success" },
  paused: { label: "Pausado", tone: "warning" },
  prospect: { label: "Prospecto", tone: "info" },
  churned: { label: "Baja", tone: "neutral" },
  scheduled: { label: "Programado", tone: "info" },
  published: { label: "Publicado", tone: "success" },
  failed: { label: "Falló", tone: "danger" },
};

export const TONE_CLASSES: Readonly<Record<StatusTone, { badge: string; dot: string }>> = {
  neutral: { badge: "bg-neutral-subtle text-neutral-strong", dot: "bg-neutral-strong" },
  info: { badge: "bg-info-subtle text-info-strong", dot: "bg-info" },
  success: { badge: "bg-success-subtle text-success-strong", dot: "bg-success" },
  warning: { badge: "bg-warning-subtle text-warning-strong", dot: "bg-warning" },
  danger: { badge: "bg-danger-subtle text-danger-strong", dot: "bg-danger" },
};

export function getStatus(status: string): StatusDef {
  return STATUS_MAP[status] ?? { label: status, tone: "neutral" };
}

export interface StatusBadgeProps {
  status: string;
  /** Sobrescribe la etiqueta del mapa. */
  label?: string;
  /** Sobrescribe el tono del mapa. */
  tone?: StatusTone;
  className?: string;
}

/** Pastilla de estado con color semántico. El color nunca es la única señal: siempre hay texto. */
export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const def = getStatus(status);
  const cls = TONE_CLASSES[tone ?? def.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        cls.badge,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", cls.dot)} />
      {label ?? def.label}
    </span>
  );
}
