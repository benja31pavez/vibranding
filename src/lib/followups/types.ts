/** Tipos compartidos de los seguimientos sugeridos (pantalla "Hoy" y fichas). */

export const FOLLOWUP_KINDS = [
  "cobro_vencido",
  "propuesta_por_vencer",
  "propuesta_sin_respuesta",
  "cobro_por_vencer",
  "prospecto_sin_avance",
  "propuesta_no_vista",
  "onboarding_pendiente",
  "prospecto_sin_respuesta",
  "reporte_sin_enviar",
  "pedir_resena",
] as const;
export type FollowupKind = (typeof FOLLOWUP_KINDS)[number];

export type FollowupPriority = "alta" | "media" | "baja";

/** Pantalla interna que resuelve el seguimiento (la UI la traduce a una ruta tipada). */
export type FollowupTarget =
  | { screen: "prospect"; prospectId: string }
  | { screen: "proposal"; proposalId: string }
  | { screen: "client"; clientId: string }
  | { screen: "client_payments"; clientId: string };

/** Link para el mensaje: ruta pública relativa (se le antepone el origen) o URL absoluta. */
export type FollowupLink =
  { kind: "path"; path: string } | { kind: "absolute"; url: string } | null;

/** Datos con que se arma la plantilla del mensaje. */
export interface TemplateData {
  kind: FollowupKind;
  businessName: string;
  /** Título de la propuesta o nombre del plan. */
  offerName: string | null;
  /** Monto ya formateado (p. ej. "$149.990" o "120 USD"). */
  amountLabel: string | null;
  /** Fecha legible (vencimiento de la propuesta o del cobro), p. ej. "7 de octubre". */
  dateLabel: string | null;
  /** Mes del reporte, p. ej. "septiembre". */
  periodLabel: string | null;
  /** Link absoluto ya resuelto (o null si no hay). */
  link: string | null;
}

export interface Followup {
  /** Estable entre recargas: `${kind}:${refId}`. Se usa para "ocultar hasta mañana". */
  id: string;
  kind: FollowupKind;
  priority: FollowupPriority;
  /** Mayor = más urgente. Solo para ordenar. */
  score: number;
  /** Por qué aparece, en una frase. */
  reason: string;
  businessName: string;
  clientId: string | null;
  prospectId: string | null;
  target: FollowupTarget;
  link: FollowupLink;
  template: Omit<TemplateData, "link">;
  /**
   * Teléfono solo si se permite WhatsApp: el contacto ya respondió alguna vez o es cliente.
   * null = no ofrecer WhatsApp (nunca WhatsApp en frío).
   */
  whatsappPhone: string | null;
  /** true: "Marcar como hecho" registra prospects.ultimo_contacto; false: se oculta hasta mañana. */
  recordsProspectContact: boolean;
}
