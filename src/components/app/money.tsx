import {
  formatMoney,
  formatPlainAmount,
  isLegacyCurrency,
  legacyCurrencyLabel,
  type ClpTotals,
} from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

export interface MoneyProps {
  amount: number;
  /**
   * Moneda guardada en el registro. La plataforma trabaja solo en CLP; si un
   * registro antiguo trae otra moneda se muestra el número sin `$` y con la
   * etiqueta "Moneda antigua (USD)", para no hacerlo pasar por pesos.
   */
  currency?: string | null;
  className?: string;
}

/** Monto en CLP (`$149.990`), con cifras tabulares. */
export function Money({ amount, currency, className }: MoneyProps) {
  if (isLegacyCurrency(currency)) {
    return (
      <span className={cn("tabular-nums", className)}>
        {formatPlainAmount(amount)}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          {legacyCurrencyLabel(currency)}
        </span>
      </span>
    );
  }
  return <span className={cn("tabular-nums", className)}>{formatMoney(amount)}</span>;
}

/** Total en CLP; avisa si quedaron fuera montos en otra moneda (no se suman). */
export function MoneyTotals({ totals, className }: { totals: ClpTotals; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(totals.clp)}
      {totals.excludedCurrencies.length > 0 && (
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          (sin incluir montos en {totals.excludedCurrencies.join(", ")})
        </span>
      )}
    </span>
  );
}
