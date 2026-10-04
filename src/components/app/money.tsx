import { formatMoney, formatMoneyTotals, type MoneyByCurrency } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

export interface MoneyProps {
  amount: number;
  /** Código ISO 4217. Por defecto CLP (sin decimales). */
  currency?: string | null;
  className?: string;
}

/** Monto formateado en es-CL con cifras tabulares (`$149.990`, `US$12,50`). */
export function Money({ amount, currency, className }: MoneyProps) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(currency, amount)}</span>;
}

/** Totales en varias monedas sin mezclarlas (`$129.990 · US$50,00`). */
export function MoneyTotals({
  totals,
  className,
}: {
  totals: MoneyByCurrency;
  className?: string;
}) {
  return <span className={cn("tabular-nums", className)}>{formatMoneyTotals(totals)}</span>;
}
