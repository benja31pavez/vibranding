import { useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  PlusCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  Money,
  Panel,
  SectionTabs,
  StatCard,
  StatusBadge,
  TableSkeleton,
  type SectionTab,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useMrr } from "@/lib/billing/mrr";
import { ivaOf, netOfTotal } from "@/lib/pricing/iva";
import {
  useAgencyExpenses,
  useAgencyPayments,
  type AgencyPaymentRow,
  type CurrentOrg,
  type ExpenseRow,
} from "@/lib/agency/queries";
import { AddExpenseDialog } from "./AddExpenseDialog";

export type FinanzasTab = "resumen" | "ingresos" | "gastos" | "f29";
export const FINANZAS_TABS: readonly FinanzasTab[] = ["resumen", "ingresos", "gastos", "f29"];
export function isFinanzasTab(v: unknown): v is FinanzasTab {
  return typeof v === "string" && (FINANZAS_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<FinanzasTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "ingresos", label: "Ingresos" },
  { key: "gastos", label: "Gastos" },
  { key: "f29", label: "F29" },
];

interface FinanzasPanelProps {
  org: CurrentOrg;
  canManage: boolean;
  tab: FinanzasTab;
  onTabChange: (tab: FinanzasTab) => void;
}

/** "2026-11" a partir de hoy (en zona de Chile). */
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 7);
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map((n) => Number(n));
  if (!year || !month) return key;
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(d);
}

export function FinanzasPanel({ org, canManage, tab, onTabChange }: FinanzasPanelProps) {
  const payments = useAgencyPayments(org.orgId);
  const expenses = useAgencyExpenses(org.orgId);
  const mrr = useMrr();
  const currentMonth = currentMonthKey();
  const [addOpen, setAddOpen] = useState(false);

  const paidThisMonth = useMemo(() => {
    const rows = (payments.data ?? []).filter(
      (p) => p.status === "paid" && monthKeyOf(p.paid_at) === currentMonth,
    );
    const total = rows.reduce((acc, r) => acc + (r.currency === "CLP" ? r.amount : 0), 0);
    const net = rows.reduce((acc, r) => acc + (r.currency === "CLP" ? netOfTotal(r.amount) : 0), 0);
    const iva = total - net;
    return { total, net, iva, count: rows.length };
  }, [payments.data, currentMonth]);

  const expensesThisMonth = useMemo(() => {
    const rows = (expenses.data ?? []).filter((e) => monthKeyOf(e.expense_date) === currentMonth);
    const total = rows.reduce((acc, r) => acc + r.total_amount, 0);
    const iva = rows.reduce((acc, r) => acc + r.iva_amount, 0);
    const net = rows.reduce((acc, r) => acc + r.net_amount, 0);
    return { total, net, iva, count: rows.length };
  }, [expenses.data, currentMonth]);

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Pestañas de Finanzas" />

      {tab === "resumen" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="MRR neto"
              icon={Wallet}
              loading={mrr.isLoading}
              value={<Money amount={mrr.data?.total ?? 0} />}
              hint="suma de membresías activas"
            />
            <StatCard
              label={`Cobrado · ${formatMonthLabel(currentMonth)}`}
              icon={TrendingUp}
              loading={payments.isLoading}
              value={<Money amount={paidThisMonth.total} />}
              hint={`${paidThisMonth.count} pagos`}
            />
            <StatCard
              label="IVA débito del mes"
              icon={Receipt}
              loading={payments.isLoading}
              value={<Money amount={paidThisMonth.iva} />}
              hint="19% sobre lo cobrado"
            />
            <StatCard
              label="Gastos del mes"
              icon={TrendingDown}
              loading={expenses.isLoading}
              value={<Money amount={expensesThisMonth.total} />}
              hint={`${expensesThisMonth.count} gastos · IVA crédito ${formatClp(
                expensesThisMonth.iva,
              )}`}
            />
          </div>

          <Panel
            icon={Wallet}
            title="Resumen del mes"
            description="Cifras calculadas sobre lo cobrado y los gastos registrados."
          >
            {paidThisMonth.count === 0 && expensesThisMonth.count === 0 ? (
              <EmptyState
                size="compact"
                icon={Wallet}
                title="Sin movimientos este mes"
                description="Cuando registres pagos recibidos o gastos de la agencia, el resumen se calcula solo."
              />
            ) : (
              <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Row label="Ingresos brutos (con IVA)" value={paidThisMonth.total} />
                <Row label="Ingresos netos" value={paidThisMonth.net} />
                <Row label="IVA débito fiscal" value={paidThisMonth.iva} />
                <Row label="Gastos brutos (con IVA)" value={expensesThisMonth.total} />
                <Row label="Gastos netos" value={expensesThisMonth.net} />
                <Row label="IVA crédito fiscal" value={expensesThisMonth.iva} />
              </dl>
            )}
          </Panel>
        </div>
      )}

      {tab === "ingresos" && <IngresosPanel payments={payments} />}

      {tab === "gastos" && (
        <GastosPanel expenses={expenses} canManage={canManage} onAdd={() => setAddOpen(true)} />
      )}

      {tab === "f29" && <F29Panel payments={payments} expenses={expenses} />}

      {addOpen && <AddExpenseDialog orgId={org.orgId} open={addOpen} onOpenChange={setAddOpen} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-sm font-medium">
        <Money amount={value} />
      </dd>
    </div>
  );
}

function formatClp(amount: number): string {
  return `$${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function IngresosPanel({ payments }: { payments: ReturnType<typeof useAgencyPayments> }) {
  if (payments.isLoading) {
    return <TableSkeleton rows={6} columns={5} label="Cargando ingresos" />;
  }
  if (payments.error) {
    return <ErrorState message={payments.error.message} onRetry={() => void payments.refetch()} />;
  }
  const rows = payments.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Aún no hay pagos registrados"
        description="Cuando un cliente pague o tú lo marques como pagado, el movimiento aparece aquí."
      />
    );
  }
  // Agrupa por cliente, muestra todo.
  return (
    <Panel
      icon={Receipt}
      title={`Ingresos recibidos (${rows.filter((r) => r.status === "paid").length} de ${rows.length})`}
      description="Todos los pagos registrados en la agencia, con su estado."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Descripción</th>
              <th className="py-2 pr-3 text-right">Monto</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <PaymentRow key={p.id} row={p} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function PaymentRow({ row }: { row: AgencyPaymentRow }) {
  const date = row.paid_at ?? row.due_date ?? row.period ?? null;
  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className="py-2 pr-3 text-foreground">{row.client_name}</td>
      <td className="py-2 pr-3 text-muted-foreground">{row.description ?? "—"}</td>
      <td className="py-2 pr-3 text-right tabular-nums">
        <Money amount={row.amount} currency={row.currency} />
      </td>
      <td className="py-2 pr-3">
        <StatusBadge status={row.status} />
      </td>
      <td className="py-2 pr-3 text-muted-foreground">{date ? date.slice(0, 10) : "—"}</td>
    </tr>
  );
}

function GastosPanel({
  expenses,
  canManage,
  onAdd,
}: {
  expenses: ReturnType<typeof useAgencyExpenses>;
  canManage: boolean;
  onAdd: () => void;
}) {
  if (expenses.isLoading) {
    return <TableSkeleton rows={5} columns={5} label="Cargando gastos" />;
  }
  if (expenses.error) {
    return <ErrorState message={expenses.error.message} onRetry={() => void expenses.refetch()} />;
  }
  const rows = expenses.data ?? [];
  return (
    <Panel
      icon={TrendingDown}
      title={`Gastos registrados (${rows.length})`}
      description="Suscripciones, servicios y pagos que hace la agencia."
      actions={
        canManage ? (
          <Button size="sm" onClick={onAdd}>
            <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden /> Agregar gasto
          </Button>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="Sin gastos registrados"
          description={
            canManage
              ? "Hoy pagas Lovable, Claude y otras suscripciones con tu tarjeta personal. Regístralas para separar las finanzas."
              : "Pídele a un administrador que registre los gastos de la agencia."
          }
          action={
            canManage ? (
              <Button size="sm" onClick={onAdd}>
                <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden /> Agregar primer gasto
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Proveedor</th>
                <th className="py-2 pr-3">Concepto</th>
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3 text-right">Neto</th>
                <th className="py-2 pr-3 text-right">IVA</th>
                <th className="py-2 pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <ExpenseRowRender key={e.id} row={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ExpenseRowRender({ row }: { row: ExpenseRow }) {
  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className="py-2 pr-3 text-muted-foreground">{row.expense_date}</td>
      <td className="py-2 pr-3 text-foreground">{row.supplier || "—"}</td>
      <td className="py-2 pr-3 text-muted-foreground">{row.concept}</td>
      <td className="py-2 pr-3 text-muted-foreground">{row.category}</td>
      <td className="py-2 pr-3 text-right tabular-nums">
        <Money amount={row.net_amount} />
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">
        <Money amount={row.iva_amount} />
      </td>
      <td className="py-2 pr-3 text-right tabular-nums font-medium">
        <Money amount={row.total_amount} />
      </td>
    </tr>
  );
}

interface F29Row {
  month: string;
  ivaDebito: number;
  ivaCredito: number;
  resultado: number;
  ingresos: number;
  gastos: number;
}

function F29Panel({
  payments,
  expenses,
}: {
  payments: ReturnType<typeof useAgencyPayments>;
  expenses: ReturnType<typeof useAgencyExpenses>;
}) {
  const rows = useMemo<F29Row[]>(() => {
    const months = new Map<string, F29Row>();
    const touch = (month: string) => {
      if (!months.has(month)) {
        months.set(month, {
          month,
          ivaDebito: 0,
          ivaCredito: 0,
          resultado: 0,
          ingresos: 0,
          gastos: 0,
        });
      }
      return months.get(month)!;
    };
    for (const p of payments.data ?? []) {
      if (p.status !== "paid") continue;
      const month = monthKeyOf(p.paid_at);
      if (!month) continue;
      if (p.currency !== "CLP") continue;
      const row = touch(month);
      row.ingresos += p.amount;
      row.ivaDebito += ivaOf(netOfTotal(p.amount));
    }
    for (const e of expenses.data ?? []) {
      const month = monthKeyOf(e.expense_date);
      if (!month) continue;
      const row = touch(month);
      row.gastos += e.total_amount;
      row.ivaCredito += e.iva_amount;
    }
    const out = Array.from(months.values()).map((r) => ({
      ...r,
      resultado: r.ivaDebito - r.ivaCredito,
    }));
    out.sort((a, b) => (a.month < b.month ? 1 : -1));
    return out;
  }, [payments.data, expenses.data]);

  const isLoading = payments.isLoading || expenses.isLoading;

  const exportCsv = () => {
    const header = [
      "Mes",
      "Ingresos brutos",
      "IVA débito",
      "Gastos brutos",
      "IVA crédito",
      "Resultado",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([r.month, r.ingresos, r.ivaDebito, r.gastos, r.ivaCredito, r.resultado].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `f29-${currentMonthKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <Panel
        icon={Receipt}
        title="F29 · IVA mensual"
        description="Herramienta de apoyo; la declaración oficial se hace en sii.cl."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden /> Exportar CSV
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="https://www.sii.cl" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden /> Ir a sii.cl
              </a>
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <ListSkeleton rows={4} label="Calculando F29" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            size="compact"
            title="Aún no hay movimientos"
            description="Registra ingresos cobrados o gastos y aparecerá el F29 mensual."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Mes</th>
                  <th className="py-2 pr-3 text-right">Ingresos</th>
                  <th className="py-2 pr-3 text-right">IVA débito</th>
                  <th className="py-2 pr-3 text-right">Gastos</th>
                  <th className="py-2 pr-3 text-right">IVA crédito</th>
                  <th className="py-2 pr-3 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month} className="border-b border-border-subtle last:border-b-0">
                    <td className="py-2 pr-3 text-foreground">{formatMonthLabel(r.month)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <Money amount={r.ingresos} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <Money amount={r.ivaDebito} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <Money amount={r.gastos} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      <Money amount={r.ivaCredito} />
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-medium ${
                        r.resultado > 0 ? "text-danger-strong" : "text-success-strong"
                      }`}
                    >
                      <Money amount={r.resultado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">
        El resultado positivo indica IVA a pagar al SII; el negativo, remanente a tu favor. Las
        cifras usan 19% y redondeo a peso entero (misma regla que la plataforma).
      </p>
    </div>
  );
}
