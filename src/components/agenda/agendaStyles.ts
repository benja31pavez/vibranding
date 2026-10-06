/** Color + ícono por tipo de evento. El ícono y el texto acompañan siempre al color. */
import {
  CalendarCheck,
  FileSignature,
  ImageIcon,
  ListChecks,
  Package,
  Receipt,
  Repeat,
  Target,
  type LucideIcon,
} from "lucide-react";
import { getStatus, type StatusTone } from "@/components/app";
import { formatTime } from "@/lib/agenda/dates";
import { BOARD_COLUMN_LABELS, taskColumn, type TaskState } from "@/lib/delivery/planStages";
import {
  AGENDA_KIND_LABEL,
  POST_APPROVAL_LABEL,
  postApprovalKey,
  type AgendaItem,
  type AgendaKind,
  type PostApprovalStatus,
} from "@/lib/agenda/types";

export interface KindStyle {
  icon: LucideIcon;
  /** Chip: fondo suave + texto + borde. */
  chip: string;
  /** Punto/muestra de color sólida. */
  dot: string;
}

export const KIND_STYLE: Readonly<Record<AgendaKind, KindStyle>> = {
  publicacion: {
    icon: ImageIcon,
    chip: "bg-fuchsia-500/10 text-fuchsia-800 border-fuchsia-500/30 dark:text-fuchsia-200",
    dot: "bg-fuchsia-500",
  },
  entregable: {
    icon: Package,
    chip: "bg-blue-500/10 text-blue-800 border-blue-500/30 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  tarea: {
    icon: ListChecks,
    chip: "bg-slate-500/10 text-slate-800 border-slate-500/30 dark:text-slate-200",
    dot: "bg-slate-500",
  },
  objetivo: {
    icon: Target,
    chip: "bg-teal-500/10 text-teal-800 border-teal-500/30 dark:text-teal-200",
    dot: "bg-teal-500",
  },
  pago: {
    icon: Receipt,
    chip: "bg-rose-500/10 text-rose-800 border-rose-500/30 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  suscripcion: {
    icon: Repeat,
    chip: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  contrato: {
    icon: FileSignature,
    chip: "bg-indigo-500/10 text-indigo-800 border-indigo-500/30 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  reserva: {
    icon: CalendarCheck,
    chip: "bg-cyan-500/10 text-cyan-800 border-cyan-500/30 dark:text-cyan-200",
    dot: "bg-cyan-500",
  },
};

/** Las publicaciones se colorean según su estado de aprobación. */
export const POST_STATUS_STYLE: Readonly<
  Record<PostApprovalStatus | "sin_estado", { chip: string; dot: string }>
> = {
  pendiente: {
    chip: "bg-yellow-500/15 text-yellow-900 border-yellow-500/40 dark:text-yellow-100",
    dot: "bg-yellow-500",
  },
  aprobado: {
    chip: "bg-green-500/10 text-green-800 border-green-500/30 dark:text-green-200",
    dot: "bg-green-500",
  },
  cambios: {
    chip: "bg-orange-500/10 text-orange-800 border-orange-500/30 dark:text-orange-200",
    dot: "bg-orange-500",
  },
  rechazado: {
    chip: "bg-red-500/10 text-red-800 border-red-500/30 dark:text-red-200 line-through",
    dot: "bg-red-500",
  },
  sin_estado: KIND_STYLE.publicacion,
};

export function itemStyle(item: AgendaItem): { chip: string; dot: string } {
  if (item.kind === "publicacion") return POST_STATUS_STYLE[postApprovalKey(item.status)];
  return KIND_STYLE[item.kind];
}

/** Estado derivado (no se guarda): tarea del Plan atrasada. */
export const TASK_LATE_STATUS = "late";

const EXTRA_STATUS: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  activa: { label: "Activa", tone: "success" },
  confirmed: { label: "Confirmada", tone: "success" },
  confirmada: { label: "Confirmada", tone: "success" },
};

/** Tareas del Plan: mismos nombres que su tablero (Pendiente / En proceso / Entregado). */
const TASK_STATE_TONE: Readonly<Record<TaskState, StatusTone>> = {
  todo: "neutral",
  doing: "warning",
  done: "success",
};

/** Etiqueta y tono del estado de un evento (siempre con texto). */
export function itemStatus(item: AgendaItem): { label: string; tone: StatusTone } | null {
  if (item.kind === "publicacion") {
    const key = postApprovalKey(item.status);
    const tone: Record<typeof key, StatusTone> = {
      pendiente: "warning",
      aprobado: "success",
      cambios: "warning",
      rechazado: "danger",
      sin_estado: "neutral",
    };
    return { label: POST_APPROVAL_LABEL[key], tone: tone[key] };
  }
  if (!item.status) return null;
  if (item.kind === "tarea") {
    // "late" lo marca el calendario del cliente (tarea no entregada con fecha vencida).
    if (item.status === TASK_LATE_STATUS)
      return { label: BOARD_COLUMN_LABELS.late, tone: "danger" };
    const state = taskColumn(item.status);
    return { label: BOARD_COLUMN_LABELS[state], tone: TASK_STATE_TONE[state] };
  }
  return EXTRA_STATUS[item.status] ?? getStatus(item.status);
}

/** Texto completo para lectores de pantalla y tooltips. */
export function describeItem(item: AgendaItem, timeZone?: string): string {
  const when = item.allDay ? "todo el día" : formatTime(item.date, timeZone);
  const status = itemStatus(item);
  return [AGENDA_KIND_LABEL[item.kind], item.clientName, when, item.title, status?.label]
    .filter(Boolean)
    .join(" · ");
}
