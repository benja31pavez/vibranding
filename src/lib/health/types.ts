/** Tipos de "Salud del cliente". Sin dependencias de React ni Supabase. */

/** "sin_datos": alguna consulta llegó a su tope y no se puede puntuar con certeza. */
export type HealthLevel = "bien" | "atencion" | "en_riesgo" | "sin_datos";
export type HealthSeverity = "warning" | "risk";

export type HealthReasonCode =
  | "cobro_vencido"
  | "aprobacion_estancada"
  | "cambios_sin_resolver"
  | "alerta_campana"
  | "reporte_sin_enviar"
  | "sin_respuesta_cliente"
  | "renovacion_cercana"
  | "onboarding_incompleto";

export interface HealthReason {
  code: HealthReasonCode;
  severity: HealthSeverity;
  /** Qué pasa, en español y con cifras ("2 cobros vencidos, el más antiguo hace 9 días"). */
  label: string;
  /** Siguiente paso sugerido. */
  action: string;
}

export interface ClientHealth {
  clientId: string;
  level: HealthLevel;
  /** 0–100; más bajo = peor. Sirve para ordenar dentro de un mismo nivel. */
  score: number;
  /** Ordenados de más a menos grave. */
  reasons: HealthReason[];
  /** Acción del motivo más grave (null si está todo bien). */
  nextAction: string | null;
  /** Días desde la última actividad conocida (null si no aplica). */
  daysSinceActivity: number | null;
}

// ------------------------------------------------------------------ entradas

export interface HealthClientInput {
  id: string;
  name: string;
  status: string;
  created_at: string;
  started_at: string | null;
}

/** Cobro abierto (pending/overdue). */
export interface HealthPaymentInput {
  client_id: string;
  status: string;
  due_date: string | null;
}

/** Pieza esperando aprobación del cliente (vista approval_queue, sin propuestas). */
export interface HealthApprovalInput {
  client_id: string | null;
  created_at: string | null;
}

/** Cambios pedidos por el cliente sin resolver (post en 'cambios' o comentario no leído). */
export interface HealthChangeRequestInput {
  client_id: string;
  created_at: string;
}

export interface HealthAlertInput {
  client_id: string;
  severity: string;
  created_at: string;
}

/** Reporte mensual del mes cerrado. */
export interface HealthReportInput {
  client_id: string;
  period: string;
  sent_at: string | null;
}

/** Señal del lado del cliente: comentario suyo, aprobación, pago o reporte enviado. */
export interface HealthActivityInput {
  client_id: string;
  at: string | null;
}

/** Pago de plan confirmado con su período (membresía; ver lib/billing/membership). */
export interface HealthPlanPaymentInput {
  client_id: string;
  status: string;
  plan_key: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
}

export interface HealthOnboardingInput {
  /** Clientes con link de onboarding emitido (client_billing.onboarding_token). */
  withToken: readonly string[];
  /** Clientes que ya enviaron el formulario (client_intake). */
  submitted: readonly string[];
}

export interface HealthSources {
  clients: readonly HealthClientInput[];
  payments: readonly HealthPaymentInput[];
  approvals: readonly HealthApprovalInput[];
  changeRequests: readonly HealthChangeRequestInput[];
  alerts: readonly HealthAlertInput[];
  reports: readonly HealthReportInput[];
  activity: readonly HealthActivityInput[];
  planPayments: readonly HealthPlanPaymentInput[];
  onboarding: HealthOnboardingInput;
  /** Clientes cuyos datos quedaron incompletos (tope de filas): no se puntúan. */
  partialClientIds: readonly string[];
}
