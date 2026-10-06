import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, MonitorSmartphone, Plus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ListSkeleton, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addonBlockedReason } from "@/lib/billing/addons";
import type { Membership } from "@/lib/billing/membership";
import { deactivateAddon, startAddonCheckout } from "@/lib/billing/membership.functions";
import {
  ADDONS,
  addonMonthlyTotal,
  addonSetupTotal,
  type Addon,
  type AddonKey,
} from "@/lib/pricing/addons";
import { formatMoney } from "@/lib/pricing/plans";
import { PAY_UNAVAILABLE, type FlowState } from "./PaymentActions";
import { errorMessage } from "./paymentWrites";

const ICONS: Readonly<Record<AddonKey, LucideIcon>> = {
  chatbot: MessageCircle,
  landing: MonitorSmartphone,
};

function PriceLine({ addon }: { addon: Addon }) {
  const monthly = addon.monthlyNet > 0;
  return (
    <p className="text-xs leading-snug tabular-nums text-muted-foreground">
      <span className="font-medium text-foreground">{formatMoney(addon.setupNet)} + IVA</span>{" "}
      {monthly ? "configuración" : "pago único"}
      {monthly && (
        <>
          {" + "}
          <span className="font-medium text-foreground">{formatMoney(addon.monthlyNet)} + IVA</span>
          /mes
        </>
      )}
      <span className="block">
        Con IVA {formatMoney(addonSetupTotal(addon))}
        {monthly && ` + ${formatMoney(addonMonthlyTotal(addon))}/mes`}
      </span>
    </p>
  );
}

export interface AddonsCardProps {
  clientId: string;
  membership: Membership | undefined;
  loading: boolean;
  flow: FlowState;
  /** Puede contratar (agencia con edición o el propio cliente). */
  canPay: boolean;
  onChanged: () => void;
}

/**
 * "Adicionales": landing extra (pago único) y chatbot (configuración + mantención
 * mensual que se suma a cada renovación del plan). El navegador solo envía qué
 * adicional; el monto lo pone el servidor (addons.ts).
 */
export function AddonsCard({
  clientId,
  membership: m,
  loading,
  flow,
  canPay,
  onChanged,
}: AddonsCardProps) {
  const checkout = useServerFn(startAddonCheckout);
  const deactivate = useServerFn(deactivateAddon);
  const [busy, setBusy] = useState<AddonKey | null>(null);
  const [emailFor, setEmailFor] = useState<AddonKey | null>(null);
  const [email, setEmail] = useState("");
  const [confirmOff, setConfirmOff] = useState<Addon | null>(null);

  const buy = async (addon: Addon, e?: FormEvent) => {
    e?.preventDefault();
    setBusy(addon.key);
    try {
      const res = await checkout({
        data: { clientId, addonKey: addon.key, ...(emailFor === addon.key ? { email } : {}) },
      });
      if (res.state === "need_email") {
        setEmailFor(addon.key);
        toast.message("Falta el correo del pagador", {
          description: "Flow lo exige para enviar el comprobante.",
        });
      } else if (res.state === "already_paid") {
        toast.success("Flow confirma que este pago ya está hecho");
        onChanged();
      } else {
        window.location.assign(res.paymentUrl);
        return;
      }
    } catch (err) {
      console.error("[facturación] error al iniciar el pago del adicional", err);
      toast.error(errorMessage(err, "No pudimos abrir el pago"));
    }
    setBusy(null);
  };

  const turnOff = async (addon: Addon) => {
    setBusy(addon.key);
    try {
      await deactivate({ data: { clientId, addonKey: addon.key } });
      toast.success(`${addon.label} dado de baja`);
      onChanged();
    } catch (err) {
      console.error("[facturación] error al dar de baja el adicional", err);
      toast.error(errorMessage(err, "No pudimos dar de baja el adicional"));
    }
    setBusy(null);
  };

  return (
    <section
      aria-labelledby="adicionales"
      className="flex shrink-0 flex-col gap-3 rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs"
    >
      <h2 id="adicionales" className="text-sm font-semibold">
        Adicionales
      </h2>
      {loading || !m ? (
        <ListSkeleton rows={1} label="Cargando adicionales" />
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {ADDONS.map((addon) => {
            const Icon = ICONS[addon.key];
            const active = m.activeAddons.includes(addon.key);
            const blocked = addonBlockedReason(m, addon);
            const note = active
              ? addon.monthlyNet > 0
                ? "Su mensualidad se suma a cada renovación de tu plan."
                : null
              : canPay
                ? blocked
                : null;
            return (
              <li
                key={addon.key}
                className="flex min-w-0 flex-col gap-2 rounded-app-md border border-border-subtle px-3 py-2.5"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-app-md bg-surface-2 text-muted-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium">{addon.label}</p>
                      {active && <StatusBadge status="activo" label="Activo" tone="success" />}
                    </div>
                    <PriceLine addon={addon} />
                  </div>
                  {canPay && !active && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0"
                      disabled={flow !== "ready" || busy !== null || blocked !== null}
                      onClick={() => void buy(addon)}
                    >
                      {busy === addon.key ? (
                        <Loader2 aria-hidden className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus aria-hidden className="mr-1 h-3.5 w-3.5" />
                      )}
                      Contratar
                    </Button>
                  )}
                  {canPay && active && addon.monthlyNet > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0 text-muted-foreground"
                      disabled={busy !== null}
                      onClick={() => setConfirmOff(addon)}
                    >
                      Dar de baja
                    </Button>
                  )}
                </div>
                {note && <p className="text-xs leading-snug text-muted-foreground">{note}</p>}
                {emailFor === addon.key && (
                  <form onSubmit={(e) => void buy(addon, e)} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label
                        htmlFor={`payer-${addon.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        Correo del pagador
                      </Label>
                      <Input
                        id={`payer-${addon.key}`}
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={busy !== null}>
                      Pagar
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canPay && flow === "off" && <p className="text-xs font-medium">{PAY_UNAVAILABLE}</p>}
      <ConfirmDialog
        open={confirmOff !== null}
        onOpenChange={(open) => !open && setConfirmOff(null)}
        title={`¿Dar de baja ${confirmOff?.label ?? "el adicional"}?`}
        description="Dejará de sumarse a tus próximas renovaciones. No hay devoluciones por lo ya pagado."
        confirmLabel="Dar de baja"
        destructive
        onConfirm={() => {
          if (confirmOff) void turnOff(confirmOff);
          setConfirmOff(null);
        }}
      />
    </section>
  );
}
