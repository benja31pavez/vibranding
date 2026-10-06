import { Money } from "@/components/app";
import { itemsTotal, type PaymentItem } from "@/lib/billing/addons";
import { formatMoney } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

/**
 * Desglose de un cobro (plan + mantención del chatbot): neto + IVA por línea y
 * total con IVA. Solo informa: el monto que se cobra lo calcula el servidor con
 * las mismas funciones (`planChargeItems`, `itemsTotal`).
 */
export function ChargeBreakdown({
  items,
  title,
  className,
}: {
  items: readonly PaymentItem[];
  title: string;
  className?: string;
}) {
  const totals = itemsTotal(items);
  return (
    <div
      className={cn(
        "rounded-app-md border border-border-subtle bg-surface-2/60 px-3 py-2.5",
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li
            key={`${item.type}-${item.key}`}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="min-w-0 text-sm leading-snug">{item.label}</span>
            <span className="shrink-0 whitespace-nowrap text-sm tabular-nums">
              {formatMoney(item.net)}
              <span className="text-xs text-muted-foreground"> + IVA</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border-subtle pt-2">
        <span className="text-sm font-medium">Total con IVA</span>
        <Money amount={totals.total} className="text-sm font-semibold" />
      </div>
    </div>
  );
}
