/**
 * Textos por defecto de las cláusulas del contrato.
 *
 * Regla: una cláusula en `null` en `pricing_settings` significa "usar el texto por
 * defecto", tanto en la pantalla de Precios como en el contrato que se genera.
 * Antes, Precios mostraba el texto por defecto pero el contrato la omitía.
 */
export const CLAUSE_DEFAULTS = {
  clause_esim:
    "El cliente asume el costo del número WhatsApp (eSIM o línea dedicada) destinado al chatbot. El servicio queda condicionado a que dicho número esté activo y al día.",
  clause_meta_api:
    "El cliente se compromete a no enviar spam, contenido engañoso ni cualquier material que vulnere las políticas de Meta. Cualquier sanción derivada de un uso indebido será de su exclusiva responsabilidad y podrá suponer la suspensión inmediata del servicio.",
  clause_late_payment:
    "Si el pago no se realiza dentro del plazo acordado, la agencia podrá suspender todos los servicios activos sin previo aviso y hasta la regularización del monto pendiente, sin que ello exima al cliente del pago.",
  clause_extra: "",
} as const;

export type ClauseKey = keyof typeof CLAUSE_DEFAULTS;

export const CLAUSE_TITLES: Record<ClauseKey, string> = {
  clause_esim: "eSIM / teléfono dedicado",
  clause_meta_api: "Uso responsable Meta API / WhatsApp",
  clause_late_payment: "Mora / suspensión por impago",
  clause_extra: "Cláusulas adicionales",
};

type ClauseSource = Partial<Record<ClauseKey, string | null | undefined>>;

/** Texto efectivo de una cláusula: el guardado o, si está en null, el por defecto. */
export function effectiveClause(p: ClauseSource, key: ClauseKey): string {
  const v = p[key];
  return (v ?? CLAUSE_DEFAULTS[key]).trim();
}

/** Lista de cláusulas que entran al contrato, en el mismo orden que la pantalla de Precios. */
export function buildContractClauses(p: ClauseSource): { title: string; body: string }[] {
  const keys: ClauseKey[] = [
    "clause_esim",
    "clause_meta_api",
    "clause_late_payment",
    "clause_extra",
  ];
  return keys
    .map((key) => ({ title: CLAUSE_TITLES[key], body: effectiveClause(p, key) }))
    .filter((c) => c.body.length > 0);
}
