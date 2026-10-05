import { Link } from "@tanstack/react-router";
import { Copy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, FitList, Money, MoneyTotals, StatusBadge } from "@/components/app";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BlockState } from "./block-state";
import {
  UPCOMING_DAYS,
  formatShortDate,
  useClientIndex,
  useOpenPayments,
  type OpenPayment,
  type PaymentsSummary,
} from "./queries";

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link de pago copiado");
  } catch (e) {
    console.error("[dashboard] no se pudo copiar el link", e);
    toast.error("No se pudo copiar. Copia el link manualmente.");
  }
}

/** Resumen en una línea: vencidos (en rojo si hay) y próximos, con su total en CLP. */
function PaymentsSummaryLine({ data }: { data: PaymentsSummary }) {
  const overdue = data.overdue.length;
  return (
    <dl className="grid grid-cols-2 gap-2">
      <div
        className={cn(
          "rounded-app-md px-3 py-1.5",
          overdue > 0 ? "bg-danger-subtle" : "bg-surface-2",
        )}
      >
        <dt className="text-xs text-muted-foreground">Vencidos</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
          <span className={cn("text-lg font-semibold", overdue > 0 && "text-danger-strong")}>
            {overdue}
          </span>
          <MoneyTotals totals={data.overdueTotals} className="text-xs text-muted-foreground" />
        </dd>
      </div>
      <div className="rounded-app-md bg-surface-2 px-3 py-1.5">
        <dt className="text-xs text-muted-foreground">Próximos {UPCOMING_DAYS} días</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
          <span className="text-lg font-semibold">{data.upcoming.length}</span>
          <MoneyTotals totals={data.upcomingTotals} className="text-xs text-muted-foreground" />
        </dd>
      </div>
    </dl>
  );
}

/** Pestaña "Cobros": vencidos + pendientes de los próximos 7 días, con sus totales. */
export function PaymentsTab() {
  const query = useOpenPayments();
  const clients = useClientIndex();
  const nameOf = (id: string) => clients.data?.nameById.get(id) ?? "Cliente";

  return (
    <BlockState query={query} loadingLabel="Cargando cobros">
      {(data) =>
        data.agenda.length === 0 ? (
          <EmptyState
            size="compact"
            className="py-3"
            icon={Wallet}
            title="Sin cobros esta semana."
            description="No hay pagos vencidos ni por vencer."
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <PaymentsSummaryLine data={data} />
            <FitList
              items={data.agenda}
              getKey={(p) => p.id}
              label="Cobros"
              sheetDescription={`Vencidos y por vencer en ${UPCOMING_DAYS} días.`}
              renderItem={(p) => <PaymentRow payment={p} clientName={nameOf(p.client_id)} />}
            />
          </div>
        )
      }
    </BlockState>
  );
}

function PaymentRow({ payment: p, clientName }: { payment: OpenPayment; clientName: string }) {
  const overdue = p.status === "overdue";
  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Link
          to="/clients/$clientId/payments"
          params={{ clientId: p.client_id }}
          className="block truncate font-medium hover:underline"
        >
          {clientName}
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={p.status} className="shrink-0" />
          {p.description && <span className="truncate">{p.description}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Money amount={p.amount} currency={p.currency} className="block font-medium" />
        <span
          className={cn(
            "text-xs tabular-nums",
            overdue ? "text-danger-strong" : "text-muted-foreground",
          )}
        >
          Vence {formatShortDate(p.due_date)}
        </span>
      </div>
      {p.payment_url ? (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          aria-label={`Copiar link de pago de ${clientName}`}
          title="Copiar link"
          onClick={() => void copyLink(p.payment_url ?? "")}
        >
          <Copy aria-hidden className="h-4 w-4" />
        </Button>
      ) : (
        <span aria-hidden className="w-8 shrink-0" />
      )}
    </div>
  );
}
