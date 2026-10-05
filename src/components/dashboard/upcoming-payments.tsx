import { Link } from "@tanstack/react-router";
import { Copy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Money, Panel, StatusBadge, TableSkeleton } from "@/components/app";
import { Button } from "@/components/ui/button";
import { BlockState } from "./block-state";
import {
  UPCOMING_DAYS,
  formatShortDate,
  useClientIndex,
  useOpenPayments,
  type OpenPayment,
} from "./queries";

const VISIBLE_ROWS = 8;

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link de pago copiado");
  } catch (e) {
    console.error("[dashboard] no se pudo copiar el link", e);
    toast.error("No se pudo copiar. Copia el link manualmente.");
  }
}

/** Vencidos + pendientes de los próximos 7 días. */
export function UpcomingPayments() {
  const query = useOpenPayments();
  const clients = useClientIndex();
  const nameOf = (id: string) => clients.data?.nameById.get(id) ?? "Cliente";

  return (
    <Panel
      icon={Wallet}
      title="Próximos cobros"
      description={`Vencidos y por vencer en ${UPCOMING_DAYS} días`}
    >
      <BlockState
        query={query}
        loadingLabel="Cargando cobros"
        skeleton={<TableSkeleton rows={3} columns={4} label="Cargando cobros" />}
      >
        {(data) =>
          data.agenda.length === 0 ? (
            <EmptyState
              size="compact"
              icon={Wallet}
              title="Sin cobros esta semana."
              description="No hay pagos vencidos ni por vencer."
            />
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      Monto
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Vence
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      Estado
                    </th>
                    <th scope="col" className="px-5 py-2">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.agenda.slice(0, VISIBLE_ROWS).map((p) => (
                    <PaymentRow key={p.id} payment={p} clientName={nameOf(p.client_id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </BlockState>
    </Panel>
  );
}

function PaymentRow({ payment: p, clientName }: { payment: OpenPayment; clientName: string }) {
  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="max-w-[12rem] px-5 py-2">
        <Link
          to="/clients/$clientId/payments"
          params={{ clientId: p.client_id }}
          className="block truncate font-medium hover:underline"
        >
          {clientName}
        </Link>
        {p.description && (
          <span className="block truncate text-xs text-muted-foreground">{p.description}</span>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        <Money amount={p.amount} currency={p.currency} />
      </td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-muted-foreground">
        {formatShortDate(p.due_date)}
      </td>
      <td className="px-2 py-2">
        <StatusBadge status={p.status} />
      </td>
      <td className="px-5 py-2 text-right">
        {p.payment_url && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => void copyLink(p.payment_url ?? "")}
          >
            <Copy aria-hidden className="mr-1 h-3.5 w-3.5" /> Copiar link
          </Button>
        )}
      </td>
    </tr>
  );
}
