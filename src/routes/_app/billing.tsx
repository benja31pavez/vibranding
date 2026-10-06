import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateClientHealth } from "@/components/clients/health/healthKeys";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  FitList,
  FitPage,
  PageHeader,
  TableSkeleton,
} from "@/components/app";
import { BillingRowHeader, BillingRowItem } from "@/components/billing/BillingRowItem";
import { BillingSummary } from "@/components/billing/BillingSummary";
import { useAuth } from "@/hooks/use-auth";
import {
  computeTotals,
  filterRows,
  loadBillingData,
  summarizeOpen,
  type BillingData,
  type BillingFilter,
  type BillingRow,
} from "@/components/billing/billingData";
import { todayInChile } from "@/lib/billing/dates";
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
  { value: "por_vencer", label: "Por vencer" },
  { value: "mes", label: "Este mes" },
  { value: "todos", label: "Todos" },
];

/** Títulos de lista vacía por filtro (sin texto de relleno). */
const EMPTY_TITLE: Readonly<Record<BillingFilter, string>> = {
  por_recordar: "Nada por recordar hoy.",
  vencidos: "No hay cobros vencidos.",
  por_vencer: `Nada vence en los próximos ${UPCOMING_DAYS} días.`,
  mes: "No hay cobros este mes.",
  todos: "Aún no hay cobros.",
};

function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BillingFilter>("por_recordar");
  const requestId = useRef(0);
  const today = todayInChile();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [reminded, setReminded] = useState<RemindedMap>({});

  useEffect(() => {
    setReminded(readReminded(today, userId));
  }, [today, userId]);

  const markReminded = (paymentId: string) => {
    setReminded((prev) => {
      const next = withReminded(prev, paymentId, today);
      writeReminded(next, userId);
      return next;
    });
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
  const open = useMemo(() => (data ? summarizeOpen(data.rows, today) : null), [data, today]);
  const counts = useMemo(() => {
    const rows = data?.rows ?? [];
    return Object.fromEntries(
      FILTERS.map((f) => [f.value, filterRows(rows, f.value, today).length]),
    ) as Record<BillingFilter, number>;
  }, [data, today]);
  const visible = useMemo(() => {
    const rows = filterRows(data?.rows ?? [], filter, today);
    if (filter !== "por_recordar") return rows;
    // Los ya recordados hoy bajan al final, manteniendo el orden por urgencia.
    const pending = rows.filter((r) => !wasRemindedToday(reminded, r.id, today));
    const done = rows.filter((r) => wasRemindedToday(reminded, r.id, today));
    return [...pending, ...done];
  }, [data, filter, today, reminded]);
  const loading = data === null && error === null;

  // Primera carga sin nada por recordar: mostrar todos en vez de una lista vacía.
  const defaultFilterChecked = useRef(false);
  useEffect(() => {
    if (!data || defaultFilterChecked.current) return;
    defaultFilterChecked.current = true;
    if (filter === "por_recordar" && filterRows(data.rows, "por_recordar", today).length === 0) {
      setFilter("todos");
    }
  }, [data, filter, today]);

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

  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? "Cobros";

  return (
    <FitPage
      header={<PageHeader size="compact" title="Cobros" />}
      contentClassName="flex flex-col gap-4"
    >
      <div className="shrink-0">
        <BillingSummary
          loading={loading}
          open={open}
          collectedThisMonth={totals.collectedThisMonth}
          receivable={totals.receivable}
          filter={filter}
          onFilter={setFilter}
        />
      </div>

      <section
        aria-label="Lista de cobros"
        className="flex min-w-0 flex-col rounded-app-lg border border-border-subtle bg-surface px-4 pt-3 pb-2 shadow-app-xs md:min-h-0 md:flex-1"
      >
        <div
          role="group"
          aria-label="Filtrar cobros"
          className="flex shrink-0 flex-wrap gap-1.5 border-b border-border-subtle pb-3"
        >
          {FILTERS.map((f) => {
            const active = filter === f.value;
            const count = counts[f.value] ?? 0;
            return (
              <Button
                key={f.value}
                size="sm"
                variant={active ? "default" : "ghost"}
                aria-pressed={active}
                className="h-8 gap-1.5"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                {data && count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      active
                        ? "bg-primary-foreground/20"
                        : f.value === "vencidos"
                          ? "bg-danger-subtle text-danger-strong"
                          : "bg-surface-2 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-col pt-2 md:min-h-0 md:flex-1">
          {loading ? (
            <TableSkeleton rows={5} columns={5} label="Cargando cobros" />
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
              size="compact"
              title={EMPTY_TITLE[filter]}
              description={
                filter === "todos"
                  ? "Se registran en la ficha de cada cliente, en Facturación."
                  : undefined
              }
            />
          ) : (
            <>
              <BillingRowHeader />
              <FitList
                items={visible}
                getKey={(r) => r.id}
                label={filterLabel}
                mobileShowAll
                renderItem={(r, ctx) => (
                  <BillingRowItem
                    row={r}
                    today={today}
                    stacked={ctx.inSheet}
                    remindedToday={wasRemindedToday(reminded, r.id, today)}
                    onReminded={() => markReminded(r.id)}
                    onMarkPaid={() => void markPaid(r)}
                    onChanged={load}
                  />
                )}
              />
            </>
          )}
        </div>
      </section>
    </FitPage>
  );
}
