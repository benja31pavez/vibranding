import { formatMoney } from "@/lib/pricing/plans";
import { computeTotals, type ProposalItem } from "@/lib/proposals/model";

const clp = (n: number) => formatMoney("CLP", n);

function billingLabel(item: ProposalItem): string {
  return item.billing === "monthly" ? "mensual" : "pago único";
}

/** Detalle de ítems + totales (neto, IVA, total). Lo usan el editor y la página pública. */
export function ProposalLines({ items }: { items: readonly ProposalItem[] }) {
  const totals = computeTotals(items);
  const mixed = totals.oneTime !== 0 && totals.monthly !== 0;

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border-subtle">
        {items.map((item, idx) => (
          <li key={`${item.label}-${idx}`} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.type === "plan" ? "Plan" : item.amount < 0 ? "Descuento" : "Adicional"} · {billingLabel(item)}
              </p>
            </div>
            <p className="shrink-0 text-right tabular-nums">
              {clp(item.amount)}
              {item.billing === "monthly" && <span className="text-xs text-muted-foreground">/mes</span>}
            </p>
          </li>
        ))}
      </ul>

      <dl className="space-y-1.5 rounded-app-md bg-surface-2 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Neto</dt>
          <dd className="tabular-nums">{clp(totals.vat.net)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">IVA (19%)</dt>
          <dd className="tabular-nums">{clp(totals.vat.vat)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border-subtle pt-2 text-base font-semibold">
          <dt>{totals.monthly > 0 ? "Primer pago (IVA incluido)" : "Total (IVA incluido)"}</dt>
          <dd className="tabular-nums">{clp(totals.firstCharge)}</dd>
        </div>
        {totals.monthly > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            {mixed
              ? `Incluye ${clp(totals.oneTime)} de pago único + el primer mes. Luego ${clp(totals.monthly)} al mes.`
              : `Luego ${clp(totals.monthly)} al mes (IVA incluido).`}
          </p>
        )}
      </dl>
    </div>
  );
}
