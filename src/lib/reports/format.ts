/** Formato es-CL para el reporte mensual (compartido entre servidor y página). */

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("es-CL");
}

export function fmtMoney(amount: number, currency: string = "CLP"): string {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** Variación relativa (0.23 = +23%) o null si no hay base para comparar. */
export function relativeChange(value: number, previous: number | null | undefined): number | null {
  if (previous == null || previous <= 0) return null;
  return (value - previous) / previous;
}

export function fmtPct(ratio: number): string {
  return `${Math.round(Math.abs(ratio) * 100).toLocaleString("es-CL")}%`;
}

export function fmtSignedPct(ratio: number): string {
  const sign = ratio > 0 ? "+" : ratio < 0 ? "−" : "";
  return `${sign}${fmtPct(ratio)}`;
}
