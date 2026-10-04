import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLANS, findPlan, formatMoney, type PlanKey } from "@/lib/pricing/plans";
import { invalidateShellClients } from "@/components/shell/shellQueries";
import {
  CLIENT_STATUSES, CLIENT_STATUS_META, PERMISSION_DENIED_MSG, fichaKeys, isClientStatus,
  type ClientStatus, type FichaOverview,
} from "./fichaQueries";

const NO_PLAN = "none";
const MIN_BILLING_DAY = 1;
const MAX_BILLING_DAY = 28;
const MAX_MRR = 100_000_000;

interface Draft {
  planKey: PlanKey | typeof NO_PLAN;
  mrr: string;
  billingDay: string;
  status: ClientStatus;
  startedAt: string;
}

function toDraft(o: FichaOverview): Draft {
  const plan = findPlan(o.billing?.plan_key);
  return {
    planKey: plan?.key ?? NO_PLAN,
    mrr: String(o.billing?.mrr ?? 0),
    billingDay: o.billing?.billing_day ? String(o.billing.billing_day) : "",
    status: isClientStatus(o.status) ? o.status : "activo",
    startedAt: o.startedAt ?? "",
  };
}

type Parsed =
  | { ok: true; mrr: number; billingDay: number | null; planKey: PlanKey | null }
  | { ok: false; error: string };

function parseDraft(d: Draft): Parsed {
  const mrr = Number(d.mrr);
  if (!Number.isInteger(mrr) || mrr < 0 || mrr > MAX_MRR) {
    return { ok: false, error: "El MRR debe ser un monto entero en CLP, sin puntos ni decimales." };
  }
  let billingDay: number | null = null;
  if (d.billingDay.trim()) {
    billingDay = Number(d.billingDay);
    if (!Number.isInteger(billingDay) || billingDay < MIN_BILLING_DAY || billingDay > MAX_BILLING_DAY) {
      return { ok: false, error: `El día de cobro debe estar entre ${MIN_BILLING_DAY} y ${MAX_BILLING_DAY}.` };
    }
  }
  if (d.startedAt && !/^\d{4}-\d{2}-\d{2}$/.test(d.startedAt)) {
    return { ok: false, error: "La fecha de inicio no es válida." };
  }
  return { ok: true, mrr, billingDay, planKey: d.planKey === NO_PLAN ? null : d.planKey };
}

/** Escribe client_billing: actualiza la fila 1:1 y, si no existiera, la crea. */
async function saveBilling(clientId: string, values: { plan_key: PlanKey | null; mrr: number; billing_day: number | null }) {
  const upd = await supabase.from("client_billing").update(values).eq("client_id", clientId).select("client_id");
  if (upd.error) return upd.error.message;
  if (upd.data && upd.data.length > 0) return null;
  // 0 filas: o falta la fila (cliente antiguo) o no hay permisos; el INSERT lo distingue vía RLS.
  const ins = await supabase.from("client_billing").insert({ client_id: clientId, ...values });
  return ins.error ? PERMISSION_DENIED_MSG : null;
}

export function BillingCard({ clientId, overview }: { clientId: string; overview: FichaOverview }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(overview));
  const [saving, setSaving] = useState(false);
  const [mrrHint, setMrrHint] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDraft(overview));
    setMrrHint(null);
  }, [overview]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const onPlanChange = (value: string) => {
    const plan = findPlan(value);
    if (plan?.billing === "monthly") {
      setDraft((d) => ({ ...d, planKey: plan.key, mrr: String(plan.price) }));
      setMrrHint(`Sugerido: ${formatMoney(null, plan.price)} al mes según ${plan.label}.`);
      return;
    }
    setDraft((d) => ({ ...d, planKey: plan?.key ?? NO_PLAN }));
    setMrrHint(plan ? `${plan.label} es un pago único (${formatMoney(null, plan.price)}); no suma MRR.` : null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setSaving(true);
    try {
      const billingError = await saveBilling(clientId, {
        plan_key: parsed.planKey,
        mrr: parsed.mrr,
        billing_day: parsed.billingDay,
      });
      if (billingError) throw new Error(billingError);
      const cli = await supabase
        .from("clients")
        .update({ status: draft.status, started_at: draft.startedAt || null })
        .eq("id", clientId)
        .select("id");
      if (cli.error) throw new Error(cli.error.message);
      if (!cli.data || cli.data.length === 0) throw new Error(PERMISSION_DENIED_MSG);
      toast.success("Plan y facturación guardados");
      await queryClient.invalidateQueries({ queryKey: fichaKeys.all(clientId) });
      void invalidateShellClients(queryClient);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !overview.canEdit;

  return (
    <Panel
      title="Plan y facturación"
      icon={CreditCard}
      description={readOnly ? "Solo lectura: no tienes permisos de edición en este cliente." : undefined}
    >
      <form onSubmit={submit} className="space-y-3">
        <fieldset disabled={readOnly || saving} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Plan" htmlFor="billing-plan" className="sm:col-span-2">
            <Select value={draft.planKey} onValueChange={onPlanChange} disabled={readOnly || saving}>
              <SelectTrigger id="billing-plan"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PLAN}>Sin plan</SelectItem>
                {PLANS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label} · {formatMoney(null, p.price)}{p.billing === "monthly" ? "/mes" : " único"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="MRR (CLP)" htmlFor="billing-mrr" className="sm:col-span-2" hint={mrrHint}>
            <Input
              id="billing-mrr"
              inputMode="numeric"
              value={draft.mrr}
              onChange={(e) => { set("mrr", e.target.value.replace(/\D/g, "")); setMrrHint(null); }}
            />
          </Field>
          <Field label="Día de cobro (1-28)" htmlFor="billing-day">
            <Input
              id="billing-day"
              type="number"
              min={MIN_BILLING_DAY}
              max={MAX_BILLING_DAY}
              value={draft.billingDay}
              onChange={(e) => set("billingDay", e.target.value)}
            />
          </Field>
          <Field label="Cliente desde" htmlFor="billing-started">
            <Input id="billing-started" type="date" value={draft.startedAt} onChange={(e) => set("startedAt", e.target.value)} />
          </Field>
          <Field label="Estado comercial" htmlFor="billing-status" className="sm:col-span-2">
            <Select value={draft.status} onValueChange={(v) => set("status", v as ClientStatus)} disabled={readOnly || saving}>
              <SelectTrigger id="billing-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLIENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{CLIENT_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </fieldset>
        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

function Field({
  label, htmlFor, hint, className, children,
}: { label: string; htmlFor: string; hint?: string | null; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
