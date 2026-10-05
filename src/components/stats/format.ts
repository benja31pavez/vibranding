const NUM = new Intl.NumberFormat("es-CL");
const PCT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

export const formatCount = (n: number): string => NUM.format(n);

/** "12,5 %" o "—" cuando no hay base para calcular la tasa. */
export const formatRate = (rate: number | null): string =>
  rate === null ? "—" : `${PCT.format(rate)} %`;
