import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { startPlanCheckout } from "@/lib/billing/membership.functions";
import { RENEW_WINDOW_DAYS, purchasablePlans, type Membership } from "@/lib/billing/membership";
import { formatMoney, type Plan, type PlanKey } from "@/lib/pricing/plans";
import { addDays } from "@/lib/billing/dates";
import { cn } from "@/lib/utils";
import { fmtDay } from "./format";
import { PAY_UNAVAILABLE, type FlowState } from "./PaymentActions";
import { errorMessage } from "./paymentWrites";

/** Condiciones que se muestran junto al botón de pago. */
function termsFor(plan: Plan | undefined): string {
  if (plan?.billing === "one_time") return "Pago único. No hay devoluciones.";
  return "Cubre un mes desde el día de pago. Sin permanencia ni cobros automáticos: renuevas cuando termine. No hay devoluciones ni pausas.";
}

function PlanOption({ plan, id }: { plan: Plan; id: string }) {
  return (
    <Label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-app-md border border-border-subtle px-3 py-2.5 font-normal transition-colors hover:bg-surface-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-surface-2"
    >
      <RadioGroupItem value={plan.key} id={id} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{plan.label}</span>
      <span className="shrink-0 text-right text-sm tabular-nums">
        {formatMoney(plan.netPrice)}
        <span className="text-xs text-muted-foreground">
          {plan.billing === "monthly" ? " + IVA/mes" : " + IVA"}
        </span>
      </span>
    </Label>
  );
}

/**
 * Contratar o renovar el plan con Flow. El monto lo pone el servidor (plans.ts);
 * aquí solo se elige el plan. Sin Flow, los botones quedan deshabilitados.
 */
export function MembershipActions({
  clientId,
  membership: m,
  flow,
  canPay,
}: {
  clientId: string;
  membership: Membership;
  flow: FlowState;
  canPay: boolean;
}) {
  const checkout = useServerFn(startPlanCheckout);
  const options = purchasablePlans(m);
  // Por defecto, el último plan del cliente si puede volver a pagarlo.
  const preferred = (options.find((p) => p.key === m.planKey) ?? options[0])?.key ?? null;
  const [selected, setSelected] = useState<PlanKey | null>(preferred);
  const [busy, setBusy] = useState(false);
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const optionKeys = options.map((p) => p.key).join(",");

  useEffect(() => {
    setSelected((current) =>
      current && optionKeys.split(",").includes(current) ? current : preferred,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKeys]);

  if (!canPay) return null;

  if (options.length === 0) {
    if (m.renewed || !m.coveredUntil) return null;
    return (
      <p className="text-xs text-muted-foreground">
        Podrás renovar desde el {fmtDay(addDays(m.coveredUntil, -RENEW_WINDOW_DAYS))}.
      </p>
    );
  }

  const plan = options.find((p) => p.key === selected) ?? options[0];
  const renewSame = m.state === "por_renovar" && options.length === 1;
  const disabled = flow !== "ready" || busy;
  const label = renewSame
    ? `Renovar ${plan.label}`
    : m.state === "pago_unico"
      ? "Contratar plan mensual"
      : "Contratar y pagar";

  const pay = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await checkout({
        data: { clientId, planKey: plan.key, ...(needEmail ? { email } : {}) },
      });
      if (res.state === "need_email") {
        setNeedEmail(true);
        toast.message("Falta el correo del pagador", {
          description: "Flow lo exige para enviar el comprobante.",
        });
      } else if (res.state === "already_paid") {
        toast.success("Flow confirma que este pago ya está hecho");
      } else {
        window.location.assign(res.paymentUrl);
        return;
      }
    } catch (err) {
      console.error("[facturación] error al iniciar el pago del plan", err);
      toast.error(errorMessage(err, "No pudimos abrir el pago"));
    }
    setBusy(false);
  };

  return (
    <form onSubmit={pay} className="flex flex-col gap-3 border-t border-border-subtle pt-3">
      {!renewSame && (
        <RadioGroup
          value={plan.key}
          onValueChange={(v) => setSelected(v as PlanKey)}
          aria-label="Elige tu plan"
          className="gap-2"
        >
          {options.map((p) => (
            <PlanOption key={p.key} plan={p} id={`plan-${p.key}`} />
          ))}
        </RadioGroup>
      )}

      {needEmail && (
        <div className="space-y-1.5">
          <Label htmlFor="payer-email" className="text-xs text-muted-foreground">
            Correo del pagador
          </Label>
          <Input
            id="payer-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}

      <Button type="submit" disabled={disabled} className="w-full">
        {busy ? (
          <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
        ) : renewSame ? (
          <RefreshCw aria-hidden className="mr-1.5 h-4 w-4" />
        ) : (
          <CreditCard aria-hidden className="mr-1.5 h-4 w-4" />
        )}
        {label}
      </Button>
      <p className={cn("text-xs", flow === "off" ? "font-medium" : "text-muted-foreground")}>
        {flow === "off" ? PAY_UNAVAILABLE : termsFor(plan)}
      </p>
    </form>
  );
}
