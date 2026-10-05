import { ErrorState, ListSkeleton, Money } from "@/components/app";
import { findPlan } from "@/lib/pricing/plans";
import { FactGrid } from "./FactGrid";
import {
  CLIENT_STATUS_META,
  formatDate,
  isClientStatus,
  type FichaOverview,
  type useFichaOverview,
} from "./fichaQueries";

/** Resumen de solo lectura de Plan y facturación (se edita en el panel lateral). */
export function BillingSummary({ overview }: { overview: ReturnType<typeof useFichaOverview> }) {
  if (overview.isLoading) return <ListSkeleton rows={2} label="Cargando facturación" />;
  if (overview.error) {
    return (
      <ErrorState
        message={overview.error.message}
        onRetry={() => void overview.refetch()}
        retrying={overview.isFetching}
      />
    );
  }
  if (!overview.data) return null;
  return <FactGrid facts={billingFacts(overview.data)} columns={3} />;
}

function billingFacts(data: FichaOverview) {
  const billingDay = data.billing?.billing_day;
  return [
    { label: "Plan", value: planName(data) },
    { label: "MRR neto", value: <Money amount={data.billing?.mrr ?? 0} /> },
    { label: "Día de cobro", value: billingDay ? `Día ${billingDay}` : "—" },
    { label: "Cliente desde", value: formatDate(data.startedAt) },
    {
      label: "Estado",
      value: isClientStatus(data.status) ? CLIENT_STATUS_META[data.status].label : data.status,
    },
  ];
}

/** Nombre corto del plan ("Crecimiento"): la etiqueta ya dice "Plan". */
function planName(data: FichaOverview): string {
  const label = findPlan(data.billing?.plan_key)?.label;
  return label ? label.replace(/^Plan\s+/i, "") : "Sin plan";
}

/** Resumen de una línea para el encabezado plegado. */
export function billingHeadline(data: FichaOverview) {
  const plan = findPlan(data.billing?.plan_key);
  const status = isClientStatus(data.status) ? CLIENT_STATUS_META[data.status].label : data.status;
  return (
    <>
      {plan?.label ?? "Sin plan"} · <Money amount={data.billing?.mrr ?? 0} />
      {data.billing?.billing_day ? ` · día ${data.billing.billing_day}` : ""} · {status}
    </>
  );
}
