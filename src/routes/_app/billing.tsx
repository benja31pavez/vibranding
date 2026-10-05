import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateClientHealth } from "@/components/clients/health/healthKeys";
import { BellRing, CheckCircle2, Receipt, Repeat, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Money, MoneyTotals, PageContainer, PageHeader, StatCard, StatusBadge, TableSkeleton } from "@/components/app";
import { PaymentLinkButton } from "@/components/billing/PaymentLinkButton";
import { PaymentReminderDialog } from "@/components/billing/PaymentReminderDialog";
import { useAuth } from "@/hooks/use-auth";
import {
  computeTotals,
  filterRows,
  isOverdue,
  loadBillingData,
  type BillingData,
  type BillingFilter,
  type BillingRow,
} from "@/components/billing/billingData";
import { periodLabel, todayInChile } from "@/lib/billing/dates";
import { useMrr } from "@/lib/billing/mrr";
import { UPCOMING_DAYS } from "@/lib/billing/openPayments";
import { wasRemindedToday, withReminded, type RemindedMap } from "@/lib/billing/reminders";
import { readReminded, writeReminded } from "@/lib/billing/remindedStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Cobros · Vibranding" },
      {
        name: "description",
        content: "Todos los cobros de la agencia: vencidos, del mes y por cobrar.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

/** RLS oculta filas en vez de fallar: 0 filas afectadas = sin permiso. */
const NO_PERMISSION = "No tienes permisos para esta acción";

const FILTERS: ReadonlyArray<{ value: BillingFilter; label: string }> = [
  { value: "por_recordar", label: "Por recordar" },
  { value: "vencidos", label: "Vencidos" },
  { value: "por_vencer", label: `Por vencer (${UPCOMING_DAYS} días)` },
  { value: "mes", label: "Este mes" },
  { value: "todos", label: "Todos" },
];

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "UTC" });
const fmtDate = (iso: string | null) =>
  iso ? DATE_FMT.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "—";

function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BillingFilter>("por_recordar");
  const requestId = useRef(0);
  const today = todayInChile();
  const mrr = useMrr();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [reminded, setReminded] = useState<RemindedMap>({});

  useEffect(() => {
    setReminded(readReminded(today, userId));
  }, [today, userId]);

  const markReminded = (paymentId: string) => {
    const next = withReminded(reminded, paymentId, today);
    setReminded(next);
    writeReminded(next, userId);
  };

  const load = async () => {
    const id = ++requestId.current;
    try {
      const next = await loadBillingData();
      if (id !== requestId.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (id !== requestId.current) return;
      console.error("[billing] error al cargar", e);
      setError((e as Error).message || "No se pudieron cargar los cobros");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => computeTotals(data?.rows ?? [], today), [data, today]);
  const visible = useMemo(() => {
    const rows = filterRows(data?.rows ?? [], filter, today);
    if (filter !== "por_recordar") return rows;
    // Los ya recordados hoy bajan al final, manteniendo el orden por urgencia.
    const pending = rows.filter((r) => !wasRemindedToday(reminded, r.id, today));
    const done = rows.filter((r) => wasRemindedToday(reminded, r.id, today));
    return [...pending, ...done];
  }, [data, filter, today, reminded]);
  const loading = data === null && error === null;

  const markPaid = async (row: BillingRow) => {
    // set_payment_status valida permisos y transición, y registra provider='manual'.
    const { error: err } = await supabase.rpc("set_payment_status", {
      _payment_id: row.id,
      _status: "paid",
      _paid_at: today,
    });
    if (err?.code === "42501") toast.error(NO_PERMISSION);
    else if (err) toast.error(`No se pudo actualizar el pago: ${err.message}`);
    else toast.success("Cobro marcado como pagado");
    load();
    void invalidateClientHealth(queryClient);
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Cobros" description="Todos los cobros de tus clientes en un solo lugar." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Cobrado del mes"
          icon={CheckCircle2}
          loading={loading}
          value={<MoneyTotals totals={totals.collectedThisMonth} />}
        />
        <StatCard
          label="Por cobrar"
          icon={Wallet}
          loading={loading}
          value={<MoneyTotals totals={totals.receivable} />}
        />
        <StatCard
          label="MRR"
          icon={Repeat}
          loading={mrr.isPending && !mrr.isError}
          hint="Suscripciones activas + facturación manual de clientes activos"
          value={
            mrr.isError ? (
              <span role="alert" className="text-base text-danger-strong">
                No disponible{" "}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void mrr.refetch()}>
                  Reintentar
                </Button>
              </span>
            ) : (
              <Money amount={mrr.data?.total ?? 0} currency="CLP" />
            )
          }
        />
      </div>

      <div role="group" aria-label="Filtrar cobros" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} label="Cargando cobros" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setData(null);
            load();
          }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            filter === "por_recordar"
              ? "No hay cobros por recordar."
              : filter === "vencidos"
              ? "No hay cobros vencidos."
              : filter === "por_vencer"
                ? `No hay cobros que venzan en los próximos ${UPCOMING_DAYS} días.`
                : "Sin cobros para este filtro."
          }
          description="Los cobros se registran desde la ficha de cada cliente, en Facturación."
        />
      ) : (
        <BillingTable
          rows={visible}
          today={today}
          reminded={reminded}
          onReminded={markReminded}
          onMarkPaid={markPaid}
          onChanged={load}
        />
      )}
    </PageContainer>
  );
}

function BillingTable({
  rows,
  today,
  reminded,
  onReminded,
  onMarkPaid,
  onChanged,
}: {
  rows: readonly BillingRow[];
  today: string;
  reminded: RemindedMap;
  onReminded: (paymentId: string) => void;
  onMarkPaid: (row: BillingRow) => void;
  onChanged: () => void;
}) {
  return (
    <div className="overflow-x-auto rounded-app-lg border border-border-subtle bg-surface shadow-app-xs">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-border-subtle text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Cliente
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Concepto
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Período
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Monto
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Vencimiento
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Estado
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const late = isOverdue(r, today);
            const open = r.status === "pending" || r.status === "overdue";
            return (
              <tr key={r.id} className="border-b border-border-subtle last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link
                    to="/clients/$clientId/facturacion"
                    params={{ clientId: r.client_id }}
                    search={{ tab: "pagos" }}
                    className="rounded-app-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {r.client_name}
                  </Link>
                </td>
                <td className="max-w-[220px] truncate px-4 py-3">{r.description || "Cobro"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.period ? periodLabel(r.period) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  <Money amount={r.amount} currency={r.currency} />
                </td>
                <td
                  className={cn("px-4 py-3", late ? "text-danger-strong" : "text-muted-foreground")}
                >
                  {fmtDate(r.due_date)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={late ? "overdue" : r.status} />
                    {open && wasRemindedToday(reminded, r.id, today) && (
                      <span className="text-xs text-muted-foreground">Recordado hoy</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {open && (
                    <div className="flex justify-end gap-2">
                      <RemindButton row={r} today={today} onReminded={() => onReminded(r.id)} />
                      <PaymentLinkButton payment={r} onChanged={onChanged} />
                      <Button size="sm" variant="ghost" onClick={() => onMarkPaid(r)}>
                        Marcar pagado
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RemindButton({
  row,
  today,
  onReminded,
}: {
  row: BillingRow;
  today: string;
  onReminded: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BellRing className="mr-1 h-3.5 w-3.5" aria-hidden />
        Recordar pago
      </Button>
      {open && (
        <PaymentReminderDialog
          open={open}
          onOpenChange={setOpen}
          payment={row}
          clientId={row.client_id}
          clientName={row.client_name}
          today={today}
          onReminded={onReminded}
        />
      )}
    </>
  );
}
