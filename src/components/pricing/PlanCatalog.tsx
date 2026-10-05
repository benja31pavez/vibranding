import { Rocket, Camera, MonitorSmartphone, RefreshCw } from "lucide-react";
import { PLANS, formatMoney, type Plan, type PlanKey } from "@/lib/pricing/plans";
import { IVA_LABEL, breakdownFromNet } from "@/lib/pricing/iva";

const PLAN_ICONS: Record<PlanKey, React.ComponentType<{ className?: string }>> = {
  "marca-web": MonitorSmartphone,
  contenido: Camera,
  crecimiento: Rocket,
  mantencion: RefreshCw,
};

const PLAN_TONES: Record<PlanKey, string> = {
  "marca-web": "var(--brand-1)",
  contenido: "var(--brand-2)",
  crecimiento: "var(--brand-3)",
  mantencion: "var(--brand-2)",
};

/** Desglose de un precio NETO: IVA 19 % y total a pagar. */
export function VatLines({ net, label }: { net: number; label?: string }) {
  const { iva, total } = breakdownFromNet(net);
  return (
    <div className="text-[11px] text-muted-foreground tabular-nums leading-snug">
      {label && <span className="font-medium">{label}: </span>}
      IVA {IVA_LABEL} {formatMoney(iva)} · Total a pagar {formatMoney(total)}
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
          {formatMoney(plan.netPrice)}
          <span className="text-sm font-medium text-muted-foreground">
            {plan.billing === "monthly" ? " + IVA/mes" : " + IVA (pago único)"}
          </span>
        </div>
        <VatLines net={plan.netPrice} />
      </div>
      {(plan.minMonths || plan.note || !plan.isPublic) && (
        <ul className="text-[11px] text-muted-foreground space-y-0.5 border-t pt-2">
          {plan.minMonths && <li>Permanencia mínima: {plan.minMonths} meses</li>}
          {plan.note && <li>{plan.note}</li>}
          {!plan.isPublic && <li>No se muestra en el sitio público.</li>}
        </ul>
      )}
    </div>
  );
}

export function PlanCatalog() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {PLANS.map((plan) => (
        <PlanCard key={plan.key} plan={plan} />
      ))}
    </div>
  );
}
