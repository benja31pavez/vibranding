import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SERVICE_CATALOG, type ServiceKey, type ServicePricing } from "@/components/PricingPanel";
import { PLANS, findPlan, formatMoney, type Plan, type PlanKey } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";
import {
  addonHasPrice,
  computeDraftTotals,
  type ClientLegalData,
  type ContractTotals,
} from "./contractModel";

export interface NewContractFormProps {
  clientName: string;
  services: Record<ServiceKey, ServicePricing>;
  selectedPlan: PlanKey | null;
  onSelectPlan: (plan: PlanKey | null) => void;
  selectedAddons: ReadonlySet<ServiceKey>;
  onToggleAddon: (key: ServiceKey) => void;
  legal: ClientLegalData;
  onLegalChange: (field: keyof ClientLegalData, value: string) => void;
  paymentDueDays: number;
  creating: boolean;
  onCreate: () => void;
}

/** Formulario "Nuevo contrato" en tres pasos (plan, extras, datos) con resumen y total. */
export function NewContractForm(props: NewContractFormProps) {
  const { selectedPlan, selectedAddons, services } = props;
  const plan = findPlan(selectedPlan);
  const hasSelection = Boolean(plan) || selectedAddons.size > 0;

  return (
    <section
      aria-labelledby="new-contract-title"
      className="flex flex-col rounded-app-lg border border-border-subtle bg-surface shadow-app-xs"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border-subtle px-5 py-3">
        <h2 id="new-contract-title" className="text-sm font-semibold text-foreground">
          Nuevo contrato
        </h2>
        <p className="text-xs text-muted-foreground">
          Para <span className="font-medium text-foreground">{props.clientName}</span> · CLP,
          precios netos + IVA
        </p>
      </header>

      <div className="flex-1 space-y-3 px-5 py-3">
        <Step number={1} title="Plan" done={Boolean(plan)}>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
            role="radiogroup"
            aria-label="Plan"
          >
            {PLANS.map((p) => (
              <PlanOption
                key={p.key}
                plan={p}
                checked={selectedPlan === p.key}
                onSelect={() => props.onSelectPlan(selectedPlan === p.key ? null : p.key)}
              />
            ))}
          </div>
        </Step>

        <Step number={2} title="Extras" hint="Opcional" done={selectedAddons.size > 0}>
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICE_CATALOG.map((s) => (
                <AddonOption
                  key={s.key}
                  label={s.label}
                  row={services[s.key]}
                  checked={selectedAddons.has(s.key)}
                  onToggle={() => props.onToggleAddon(s.key)}
                />
              ))}
            </div>
          </TooltipProvider>
        </Step>

        <Step number={3} title="Datos del cliente" done={Boolean(props.legal.legalName.trim())}>
          <LegalFields
            clientName={props.clientName}
            legal={props.legal}
            onChange={props.onLegalChange}
          />
        </Step>
      </div>

      <ContractSummary
        plan={plan}
        hasSelection={hasSelection}
        totals={computeDraftTotals(plan, selectedAddons, services)}
        paymentDueDays={props.paymentDueDays}
        creating={props.creating}
        onCreate={props.onCreate}
      />
    </section>
  );
}

function Step({
  number,
  title,
  hint,
  done,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-[5.75rem_minmax(0,1fr)] sm:gap-3">
      {/* <legend> no admite grid; el título visible va en un div y la legend queda para lectores. */}
      <legend className="sr-only">{title}</legend>
      <div aria-hidden className="flex items-start gap-2 text-xs sm:pt-1">
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] tabular-nums",
            done ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground",
          )}
        >
          {done ? <Check className="h-3 w-3" /> : number}
        </span>
        <span className="pt-0.5 leading-tight">
          <span className="block font-semibold text-foreground">{title}</span>
          {hint && <span className="block text-muted-foreground">{hint}</span>}
        </span>
      </div>
      <div className="min-w-0">{children}</div>
    </fieldset>
  );
}

function PlanOption({
  plan,
  checked,
  onSelect,
}: {
  plan: Plan;
  checked: boolean;
  onSelect: () => void;
}) {
  const cadence =
    plan.billing === "one_time"
      ? "pago único"
      : plan.minMonths
        ? `al mes · mín. ${plan.minMonths} meses`
        : "al mes";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      title={plan.note ?? plan.description}
      className={cn(
        "relative rounded-app-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border-subtle hover:border-border-strong hover:bg-surface-2/60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute right-2.5 top-2.5 grid h-4 w-4 place-items-center rounded-full border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="block truncate pr-4 text-[13px] font-medium text-foreground">
        {plan.label}
      </span>
      <span className="mt-0.5 block text-base font-semibold leading-tight tabular-nums text-foreground">
        {formatMoney(plan.netPrice)}
        <span className="text-[11px] font-normal text-muted-foreground"> + IVA</span>
      </span>
      <span className="block text-[11px] leading-tight text-muted-foreground">{cadence}</span>
    </button>
  );
}

function addonPriceLabel(row: ServicePricing): string {
  const oneTime = Number(row.one_time_price);
  const monthly = Number(row.monthly_price);
  const parts = [
    oneTime > 0 ? `Setup ${formatMoney(oneTime)} + IVA` : null,
    monthly > 0 ? `${formatMoney(monthly)} + IVA/mes` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function AddonOption({
  label,
  row,
  checked,
  onToggle,
}: {
  label: string;
  row: ServicePricing | undefined;
  checked: boolean;
  onToggle: () => void;
}) {
  if (!row || !addonHasPrice(row)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/settings/pricing"
            aria-label={`${label}: precio a cotizar. Configura su precio en Precios`}
            className="flex items-center gap-3 rounded-app-md border border-dashed border-border-subtle px-3 py-2 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden className="h-4 w-4 shrink-0 rounded-[4px] border border-dashed" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-muted-foreground">
                {label}
              </span>
              <span className="block text-[11px] text-muted-foreground">Precio a cotizar</span>
            </span>
            <Settings2 aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>Configura su precio en Precios</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 rounded-app-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border-subtle hover:border-border-strong hover:bg-surface-2/60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        <span className="block text-[11px] tabular-nums text-muted-foreground">
          {addonPriceLabel(row)}
        </span>
      </span>
    </button>
  );
}

const LEGAL_FIELDS: ReadonlyArray<{
  field: keyof ClientLegalData;
  label: string;
  placeholder?: string;
  type?: string;
}> = [
  { field: "legalName", label: "Razón social" },
  { field: "taxId", label: "RUT", placeholder: "12.345.678-9" },
  { field: "address", label: "Dirección", placeholder: "Calle, número, comuna, ciudad" },
  { field: "email", label: "Email", placeholder: "cliente@email.com", type: "email" },
];

function LegalFields({
  clientName,
  legal,
  onChange,
}: {
  clientName: string;
  legal: ClientLegalData;
  onChange: (field: keyof ClientLegalData, value: string) => void;
}) {
  const baseId = useId();
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
      {LEGAL_FIELDS.map(({ field, label, placeholder, type }) => {
        const id = `${baseId}-${field}`;
        return (
          <div key={field} className="space-y-1">
            <Label htmlFor={id} className="text-[11px] leading-none text-muted-foreground">
              {label}
            </Label>
            <Input
              id={id}
              type={type ?? "text"}
              value={legal[field]}
              placeholder={field === "legalName" ? clientName : placeholder}
              onChange={(e) => onChange(field, e.target.value)}
              className="h-8"
            />
          </div>
        );
      })}
    </div>
  );
}

function ContractSummary({
  plan,
  hasSelection,
  totals,
  paymentDueDays,
  creating,
  onCreate,
}: {
  plan: Plan | null;
  hasSelection: boolean;
  totals: ContractTotals;
  paymentDueDays: number;
  creating: boolean;
  onCreate: () => void;
}) {
  const terms = [
    `Plazo de pago ${paymentDueDays} días`,
    plan?.minMonths ? `mínimo ${plan.minMonths} meses` : null,
    plan?.note ?? null,
  ].filter(Boolean);
  return (
    <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-b-app-lg border-t border-border-subtle bg-surface-2/50 px-5 py-2.5">
      <div className="min-w-0 flex-1" aria-live="polite">
        {hasSelection ? (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            {totals.oneTime > 0 && (
              <TotalLine
                label="Pago único"
                amount={`${formatMoney(totals.oneTime)} + IVA`}
                total={`Total a pagar ${formatMoney(totals.oneTimeTotal)}`}
              />
            )}
            {totals.monthly > 0 && (
              <TotalLine
                label="Mensual"
                amount={`${formatMoney(totals.monthly)} + IVA/mes`}
                total={`Total a pagar ${formatMoney(totals.monthlyTotal)}/mes`}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Elige un plan o un extra para ver el total.
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">{terms.join(" · ")}</p>
      </div>
      <Button className="shrink-0" onClick={onCreate} disabled={creating || !hasSelection}>
        <Plus className="mr-1 h-4 w-4" /> {creating ? "Creando…" : "Crear contrato"}
      </Button>
    </footer>
  );
}

function TotalLine({ label, amount, total }: { label: string; amount: string; total: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      {label}{" "}
      <strong className="text-lg font-semibold tabular-nums text-foreground">{amount}</strong>{" "}
      <span className="text-[11px] tabular-nums">({total})</span>
    </span>
  );
}
