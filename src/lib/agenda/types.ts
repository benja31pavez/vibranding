/** Tipos y constantes de la Agenda unificada (calendario + reservas). */

export const AGENDA_KINDS = [
  "publicacion",
  "entregable",
  "tarea",
  "objetivo",
  "pago",
  "suscripcion",
  "contrato",
  "reserva",
] as const;

export type AgendaKind = (typeof AGENDA_KINDS)[number];

export const AGENDA_KIND_LABEL: Readonly<Record<AgendaKind, string>> = {
  publicacion: "Publicación",
  entregable: "Entregable",
  tarea: "Tarea",
  objetivo: "Objetivo",
  pago: "Cobro",
  suscripcion: "Suscripción",
  contrato: "Contrato",
  reserva: "Reserva",
};

export const AGENDA_KIND_LABEL_PLURAL: Readonly<Record<AgendaKind, string>> = {
  publicacion: "Publicaciones",
  entregable: "Entregables",
  tarea: "Tareas",
  objetivo: "Objetivos",
  pago: "Cobros",
  suscripcion: "Suscripciones",
  contrato: "Contratos",
  reserva: "Reservas",
};

export function isAgendaKind(value: unknown): value is AgendaKind {
  return typeof value === "string" && (AGENDA_KINDS as readonly string[]).includes(value);
}

/** Evento normalizado: todas las fuentes se traducen a esta forma. */
export interface AgendaItem {
  /** Único entre fuentes: "<kind>:<id de la fila>". */
  id: string;
  kind: AgendaKind;
  /** "YYYY-MM-DD" si es de día completo; timestamp ISO si tiene hora. */
  date: string;
  allDay: boolean;
  clientId: string | null;
  clientName: string;
  title: string;
  /** Estado crudo de la fuente (p. ej. "pendiente", "overdue", "activa"). */
  status: string | null;
  /** Ruta interna de la pantalla de origen (con search incluido). */
  href: string;
}

/** Rango de días en hora de Chile: `from` inclusivo, `to` exclusivo ("YYYY-MM-DD"). */
export interface AgendaRange {
  from: string;
  to: string;
}

export const AGENDA_VIEWS = ["mes", "semana", "lista"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const AGENDA_TABS = ["calendario", "reservas"] as const;
export type AgendaTab = (typeof AGENDA_TABS)[number];

/** Estados de aprobación de un post (CHECK de instagram_posts.approval_status). */
export const POST_APPROVAL_STATUSES = ["pendiente", "aprobado", "cambios", "rechazado"] as const;
export type PostApprovalStatus = (typeof POST_APPROVAL_STATUSES)[number];

export const POST_APPROVAL_LABEL: Readonly<Record<PostApprovalStatus | "sin_estado", string>> = {
  pendiente: "Pendiente de aprobación",
  aprobado: "Aprobada",
  cambios: "Con cambios pedidos",
  rechazado: "Rechazada",
  sin_estado: "Sin revisión",
};

export function postApprovalKey(status: string | null): PostApprovalStatus | "sin_estado" {
  return (POST_APPROVAL_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as PostApprovalStatus)
    : "sin_estado";
}
