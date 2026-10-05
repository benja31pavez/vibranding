/**
 * Umbrales de las alertas automáticas de campañas (Meta Ads).
 *
 * Todos los umbrales viven aquí para ajustarlos sin tocar las reglas.
 * Están pensados para pymes chilenas con presupuestos de 3.000–20.000 CLP
 * diarios por campaña. Los montos son en la moneda de la cuenta publicitaria:
 * solo CLP y USD tienen montos definidos; con otra moneda las reglas que
 * dependen de un monto mínimo no se evalúan (se evita alertar con umbrales
 * pensados para otra moneda).
 */

/** Montos mínimos por moneda. Para agregar una moneda, agrega su fila. */
export interface SpendThresholds {
  /** Gasto sin resultados en la ventana que dispara "Atención". */
  noResultsWarning: number;
  /** Gasto sin resultados en la ventana que dispara "Crítica". */
  noResultsCritical: number;
  /** Gasto mínimo reciente para comparar costo por resultado (evita ruido con montos chicos). */
  cpaMinRecentSpend: number;
  /** Gasto diario mínimo para alertar sobregasto (bajo esto la diferencia no importa). */
  overspendMinSpend: number;
}

export const SPEND_THRESHOLDS: Readonly<Record<string, SpendThresholds>> = {
  // ~5.000 CLP/día durante 3 días sin un solo mensaje o lead ya es plata perdida.
  CLP: { noResultsWarning: 15_000, noResultsCritical: 40_000, cpaMinRecentSpend: 10_000, overspendMinSpend: 5_000 },
  // Referencia ~950 CLP por USD.
  USD: { noResultsWarning: 16, noResultsCritical: 42, cpaMinRecentSpend: 11, overspendMinSpend: 5 },
};

/** Ventana (días cerrados) para "gasto sin resultados". */
export const NO_RESULTS_WINDOW_DAYS = 3;

/** Ventana reciente y base para comparar el costo por resultado (CPL/CPA). */
export const CPA_RECENT_DAYS = 3;
export const CPA_BASELINE_DAYS = 14;
/** Resultados mínimos en la base para que el promedio sea confiable. */
export const CPA_MIN_BASELINE_RESULTS = 5;
/** Alza sobre el promedio: 0,5 = +50 % (Atención); 1 = +100 % (Crítica). */
export const CPA_RISE_WARNING = 0.5;
export const CPA_RISE_CRITICAL = 1;

/** Días seguidos con gasto 0 en una campaña marcada activa. */
export const ZERO_SPEND_DAYS = 2;

/**
 * Sobregasto diario respecto del presupuesto diario guardado.
 * Meta puede gastar hasta un 75 % más que el presupuesto diario en un día
 * puntual (compensa en la semana), por eso 1,5× es "Atención" y sobre 2×
 * (fuera de lo que Meta permite) es "Crítica".
 */
export const OVERSPEND_WARNING_RATIO = 1.5;
export const OVERSPEND_CRITICAL_RATIO = 2;
/**
 * Sobre esta razón el presupuesto guardado no es creíble (p. ej. unidades
 * distintas entre la plataforma y Meta): se alerta como desajuste de
 * presupuesto, no como sobregasto.
 */
export const BUDGET_MISMATCH_RATIO = 20;

/** Días antes del vencimiento del token para avisar. */
export const TOKEN_EXPIRY_WARNING_DAYS = 7;

/** Horas sin una sincronización exitosa antes de avisar que no llegan datos. */
export const INGEST_STALE_HOURS = 48;

/**
 * Si alguien marcó a mano una alerta como resuelta, no se vuelve a abrir la
 * misma (misma dedupe_key) durante estos días aunque la condición siga.
 */
export const MANUAL_RESOLVE_SNOOZE_DAYS = 3;

/** Objetivos de campaña donde no se esperan mensajes ni leads (no aplica "sin resultados"/CPL). */
export const OBJECTIVES_WITHOUT_RESULTS: readonly string[] = ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC"];
