import { Rocket, Camera, MonitorSmartphone } from "lucide-react";
import {
  PLANS,
  DEFAULT_CURRENCY,
  formatMoney,
  splitVat,
  type Plan,
  type PlanKey,
} from "@/lib/pricing/plans";

const PLAN_ICONS: Record<PlanKey, React.ComponentType<{ className?: string }>> = {
  "marca-web": MonitorSmartphone,
  contenido: Camera,
  crecimiento: Rocket,
};

const PLAN_TONES: Record<PlanKey, string> = {
  "marca-web": "var(--brand-1)",
  contenido: "var(--brand-2)",
  crecimiento: "var(--brand-3)",
};

/** Desglose neto + IVA 19 % de un monto con IVA incluido. */
export function VatLines({
  gross,
  currency = DEFAULT_CURRENCY,
}: {
  gross: number;
  currency?: string;
}) {
  const { net, vat } = splitVat(gross);
  return (
    <div className="text-[11px] text-muted-foreground tabular-nums leading-snug">
      Neto {formatMoney(currency, net)} · IVA 19% {formatMoney(currency, vat)}
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const Icon = PLAN_ICONS[plan.key];
  const tone = PLAN_TONES[plan.key];
  return (
    <div
      className="rounded-2xl border bg-card p-5 space-y-3"
      style={{ borderColor: `color-mix(in oklab, ${tone} 25%, hsl(var(--border)))` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 55%, white))`,
          }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight">{plan.label}</div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{plan.description}</p>
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">
          {formatMoney(DEFAULT_CURRENCY, plan.price)}
          <span className="text-sm font-medium text-muted-foreground">
            {plan.billing === "monthly" ? "/mes" : " pago único"}
          </span>
        </div>
        <VatLines gross={plan.price} />
      </div>
      {(plan.minMonths || plan.note) && (
        <ul className="text-[11px] text-muted-foreground space-y-0.5 border-t pt-2">
          {plan.minMonths && <li>Permanencia mínima: {plan.minMonths} meses</li>}
          {plan.note && <li>{plan.note}</li>}
        </ul>
      )}
    </div>
  );
}

export function PlanCatalog() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((plan) => (
        <PlanCard key={plan.key} plan={plan} />
      ))}
    </div>
  );
}
