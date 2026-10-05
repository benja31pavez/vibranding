/**
 * IVA de VIBRANDING (Chile, 19 %). ÚNICO lugar donde se calcula.
 *
 * Modelo de precios (decisión 2026-10-05):
 *  - Los precios de lista son NETOS: "$129.990 + IVA/mes" (`plans.ts` guarda el neto).
 *  - El cliente paga neto × 1,19, redondeado a peso entero: `withIva(neto)`.
 *  - Lo que se cobra y se guarda como monto a pagar (payments.amount,
 *    subscriptions.amount_clp, proposals.amount_clp e ítems de propuestas) es
 *    siempre el TOTAL con IVA. Los registros anteriores al cambio también lo
 *    eran (precio "IVA incluido"), así que se leen igual que antes; el neto de un
 *    total guardado se obtiene con `netOfTotal`.
 *  - El MRR se informa NETO (sin IVA): el IVA no es ingreso de la agencia.
 */

export const IVA_RATE = 0.19;
/** "19%" para etiquetas. */
export const IVA_LABEL = `${Math.round(IVA_RATE * 100)}%`;

function toInt(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

/** Total a pagar de un neto: round(neto × 1,19). */
export function withIva(net: number): number {
  return Math.round(toInt(net) * (1 + IVA_RATE));
}

/** IVA de un neto. Siempre cumple `net + ivaOf(net) === withIva(net)`. */
export function ivaOf(net: number): number {
  return withIva(net) - toInt(net);
}

/**
 * Neto contenido en un total con IVA: round(total / 1,19). Para leer montos ya
 * guardados como total (cobros, propuestas, suscripciones). Es el inverso exacto
 * de `withIva` para montos enteros: netOfTotal(withIva(n)) === n.
 */
export function netOfTotal(total: number): number {
  return Math.round(toInt(total) / (1 + IVA_RATE));
}

export interface IvaBreakdown {
  readonly net: number;
  readonly iva: number;
  readonly total: number;
}

/** Desglose a partir del neto (precios de lista, montos nuevos). */
export function breakdownFromNet(net: number): IvaBreakdown {
  const n = toInt(net);
  const total = withIva(n);
  return { net: n, iva: total - n, total };
}

/** Desglose de un total ya guardado (con IVA). */
export function breakdownFromTotal(total: number): IvaBreakdown {
  const t = toInt(total);
  const net = netOfTotal(t);
  return { net, iva: t - net, total: t };
}
