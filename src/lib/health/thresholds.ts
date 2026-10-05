/**
 * Umbrales de "Salud del cliente". Todos en días de calendario (Chile).
 * Cambiar aquí ajusta el puntaje en toda la plataforma y en scripts/check-health.mjs.
 */
export const HEALTH_THRESHOLDS = {
  /** Cobro vencido hace menos de N días → Atención; desde N → En riesgo. */
  overdueRiskDays: 7,
  /** Pieza esperando aprobación del cliente: desde N días → Atención. */
  approvalWaitWarnDays: 5,
  /** Pieza esperando aprobación del cliente: desde N días → En riesgo. */
  approvalWaitRiskDays: 14,
  /** Cambios pedidos por el cliente sin resolver: desde N días → Atención. */
  changeRequestWarnDays: 2,
  /** Cambios pedidos por el cliente sin resolver: desde N días → En riesgo. */
  changeRequestRiskDays: 7,
  /** Alerta de campaña "warning" abierta: desde N días → Atención. */
  alertWarnDays: 3,
  /** Reporte del mes cerrado sin enviar: se exige desde este día del mes. */
  reportGraceDayOfMonth: 7,
  /** Sin actividad con el cliente: desde N días → Atención. */
  inactivityWarnDays: 21,
  /** Sin actividad con el cliente: desde N días → En riesgo. */
  inactivityRiskDays: 45,
  /** Ventana de búsqueda de actividad (más atrás no se consulta). */
  activityLookbackDays: 60,
  /** Fin de permanencia mínima dentro de N días → Atención (conversar renovación). */
  renewalWarnDays: 30,
  /** Fin de permanencia mínima dentro de N días → En riesgo. */
  renewalRiskDays: 7,
  /** Onboarding sin completar: desde N días desde el alta → Atención. */
  onboardingWarnDays: 7,
  /** Onboarding sin completar: desde N días desde el alta → En riesgo. */
  onboardingRiskDays: 21,
  /** Cantidad de motivos de Atención que, juntos, ya son En riesgo. */
  warningsForRisk: 3,
} as const;

/** Puntaje base; cada motivo resta su peso. */
export const HEALTH_MAX_SCORE = 100;
/** Peso de un motivo según su gravedad. */
export const HEALTH_WEIGHTS = { risk: 30, warning: 10 } as const;

/** Estados de cliente a los que se les calcula salud (prospecto y terminado no). */
export const SCORED_CLIENT_STATUSES: ReadonlySet<string> = new Set([
  "activo",
  "onboarding",
  "pausado",
]);
