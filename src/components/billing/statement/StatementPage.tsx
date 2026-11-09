import { useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Percent,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  CompactStats,
  EmptyState,
  ErrorState,
  FitPage,
  ListSkeleton,
  Money,
  MoneyTotals,
  PageHeader,
  Panel,
  SectionTabs,
  StatusBadge,
  type SectionTab,
} from "@/components/app";
import { BankAccountPanel } from "@/components/billing/BankAccountPanel";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { ReportsPanel } from "@/components/clients/ficha/ReportsPanel";
import { invalidateClientHealth } from "@/components/clients/health/healthKeys";
import { ProposalsPanel } from "@/components/proposals/ProposalsPanel";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { todayInChile } from "@/lib/billing/dates";
import { useFlowConfigured } from "@/lib/flow/config.functions";
import { membershipMrr, type Membership } from "@/lib/billing/membership";
import { useMembership } from "@/lib/billing/membership.functions";
import { paymentDocumentLabel } from "@/lib/billing/paymentDocuments";
import { groupByF29Period, type F29Payment } from "@/lib/finance/f29";
import { findPlan } from "@/lib/pricing/plans";
import { AddonsCard } from "./AddonsCard";
import { BillingInfoCard } from "./BillingInfoCard";
import { F29Panel } from "./F29Panel";
import { fmtDay, fmtMonth } from "./format";
import { PlanStatementCard } from "./PlanStatementCard";
import { DocumentButton, type FlowState } from "./PaymentActions";
import { SiiConnectCard } from "./SiiConnectCard";
import {
  displayStatus,
  sortForStatement,
  summarize,
  usePayments,
  useReloadStatement,
  useStatementAccess,
  type StatementAccess,
  type StatementPayment,
} from "./statementData";

export type FacturacionTab = "resumen" | "cobros" | "propuestas" | "documentos";
export const FACTURACION_TABS: readonly FacturacionTab[] = [
  "resumen",
  "cobros",
  "propuestas",
  "documentos",
];
export function isFacturacionTab(v: unknown): v is FacturacionTab {
  return typeof v === "string" && (FACTURACION_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<FacturacionTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "cobros", label: "Cobros" },
  { key: "propuestas", label: "Propuestas" },
  { key: "documentos", label: "Documentos" },
];

const DESCRIPTION: Readonly<Record<FacturacionTab, string>> = {
  resumen: "Plan vigente, lo pagado y lo pendiente, en una pantalla",
  cobros: "Todos los cobros del cliente: pagar con Flow, recordar, boleta y edición",
  propuestas: "Propuestas comerciales enviadas al cliente y su estado",
  documentos: "Boletas y facturas subidas a cada cobro, y los reportes mensuales",
};

const READ_ONLY: StatementAccess = { canEdit: false, canManage: false };

interface StatementPageProps {
  clientId: string;
  tab?: FacturacionTab;
  onTabChange?: (tab: FacturacionTab) => void;
}

/**
 * Facturación = estado de cuenta del cliente, con cuatro subsecciones:
 * Resumen (plan, MRR, pagado hasta, cobros abiertos), Cobros (la lista de pagos
 * con Flow), Propuestas y Documentos (boletas/facturas y reportes mensuales).
 * El plan se contrata y renueva aquí, con Flow; las herramientas de la agencia
 * solo aparecen con permiso de edición.
 */
export function StatementPage({ clientId, tab = "resumen", onTabChange }: StatementPageProps) {
  const { client } = useActiveClient();
  const membership = useMembership(clientId);
  const payments = usePayments(clientId);
  const access = useStatementAccess(clientId).data ?? READ_ONLY;
  const flowStatus = useFlowConfigured();
  const reload = useReloadStatement(clientId);
  const queryClient = useQueryClient();

  const flow: FlowState = flowStatus.isPending
    ? "loading"
    : flowStatus.data && !flowStatus.data.configured
      ? "off"
      : "ready";

  const onChanged = () => {
    void reload();
    void queryClient.invalidateQueries({ queryKey: ["membership"] });
    // "Salud del cliente" de la gestión usa cobros vencidos/pagados.
    void invalidateClientHealth(queryClient);
  };

  return (
    <StatementView
      clientId={clientId}
      clientName={client?.name ?? ""}
      today={todayInChile()}
      tab={tab}
      onTabChange={(next) => onTabChange?.(next)}
      membership={{
        data: membership.data,
        loading: membership.isPending,
        error: membership.error?.message ?? null,
        retry: () => void membership.refetch(),
      }}
      payments={{
        data: payments.data,
        loading: payments.isPending,
        error: payments.error?.message ?? null,
        retry: () => void payments.refetch(),
      }}
      access={access}
      flow={flow}
      flowMissing={flowStatus.data?.missing ?? null}
      onChanged={onChanged}
    />
  );
}

interface Loadable<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export interface StatementViewProps {
  clientId: string;
  clientName: string;
  today: string;
  tab: FacturacionTab;
  onTabChange: (tab: FacturacionTab) => void;
  membership: Loadable<Membership>;
  payments: Loadable<StatementPayment[]>;
  access: StatementAccess;
  flow: FlowState;
  flowMissing: string[] | null;
  onChanged: () => void;
}

/** Vista del estado de cuenta (sin consultas), con la barra de subsecciones. */
export function StatementView({
  clientId,
  clientName,
  today,
  tab,
  onTabChange,
  membership,
  payments,
  access,
  flow,
  flowMissing,
  onChanged,
}: StatementViewProps) {
  const rows = useMemo(() => sortForStatement(payments.data ?? []), [payments.data]);
  const summary = useMemo(() => summarize(rows, today), [rows, today]);
  const documents = useMemo(() => rows.filter((p) => p.document_path), [rows]);
  const ivaThisMonth = useMemo(() => currentMonthIva(rows, today), [rows, today]);

  const tabs: readonly SectionTab<FacturacionTab>[] = TABS.map((t) =>
    t.key === "cobros" ? { ...t, badge: summary.overdueCount } : t,
  );
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Finanzas" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={tabs} value={tab} onChange={onTabChange} label="Vistas de Finanzas" />
    </div>
  );

  if (tab === "cobros") {
    return (
      <FitPage header={header} contentClassName="flex flex-col gap-4 md:min-h-0">
        <PaymentsPanel
          clientId={clientId}
          clientName={clientName}
          payments={rows}
          loading={payments.loading}
          error={payments.error}
          onRetry={payments.retry}
          access={access}
          flow={flow}
          flowMissing={flowMissing}
          today={today}
          onChanged={onChanged}
        />
      </FitPage>
    );
  }

  if (tab === "propuestas") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <ProposalsPanel clientId={clientId} canEdit={access.canEdit} />
      </FitPage>
    );
  }

  if (tab === "documentos") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TaxDocumentsPanel
            clientId={clientId}
            documents={documents}
            loading={payments.loading}
            error={payments.error}
            onRetry={payments.retry}
            today={today}
            canEdit={access.canEdit}
          />
          <ReportsPanel clientId={clientId} clientName={clientName} canEdit={access.canEdit} />
        </div>
        <F29Panel
          clientId={clientId}
          payments={rows}
          loading={payments.loading}
          canEdit={access.canEdit}
        />
        <SiiConnectCard />
      </FitPage>
    );
  }

  return (
    <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
      <CompactStats
        label="Resumen de pagos"
        className="shrink-0 grid-flow-row grid-cols-2 md:grid-flow-col md:auto-cols-fr"
        items={[
          {
            key: "pagado",
            label: `Pagado en ${today.slice(0, 4)}`,
            icon: CheckCircle2,
            loading: payments.loading,
            value: <MoneyTotals totals={summary.paidThisYear} />,
          },
          {
            key: "por-pagar",
            label: "Por pagar",
            icon: Clock,
            loading: payments.loading,
            value: <MoneyTotals totals={summary.toPay} />,
            hint: `${summary.openCount - summary.overdueCount} ${summary.openCount - summary.overdueCount === 1 ? "cobro abierto" : "cobros abiertos"}`,
          },
          {
            key: "vencido",
            label: "Vencido",
            icon: AlertCircle,
            loading: payments.loading,
            tone: summary.overdue.clp > 0 ? "danger" : "default",
            value: <MoneyTotals totals={summary.overdue} />,
            hint: `${summary.overdueCount} ${summary.overdueCount === 1 ? "cobro vencido" : "cobros vencidos"}`,
          },
          {
            key: "iva",
            label: `IVA de ${fmtMonth(today)}`,
            icon: Percent,
            loading: payments.loading,
            value: <Money amount={ivaThisMonth} />,
            hint: "Débito del mes; ver F29 en Documentos",
          },
          {
            key: "mrr",
            label: "MRR neto",
            icon: Wallet,
            loading: membership.loading,
            value: <Money amount={membership.data ? membershipMrr(membership.data) : 0} />,
            hint: "Sin IVA, plan + adicionales",
          },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-start xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <PlanStatementCard
          clientId={clientId}
          membership={membership.data}
          loading={membership.loading}
          error={membership.error}
          onRetry={membership.retry}
          flow={flow}
          canPay={access.canEdit}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <AccountSummaryCard
            clientId={clientId}
            membership={membership}
            payments={rows}
            paymentsLoading={payments.loading}
          />
          {!membership.error && (
            <AddonsCard
              clientId={clientId}
              membership={membership.data}
              loading={membership.loading}
              flow={flow}
              canPay={access.canEdit}
              onChanged={onChanged}
            />
          )}
        </div>
      </div>
      {access.canEdit && (
        <div className="grid gap-4 md:grid-cols-2">
          <BillingInfoCard clientId={clientId} canEdit={access.canEdit} />
          <BankAccountPanel />
        </div>
      )}
    </FitPage>
  );
}

/**
 * IVA débito fiscal del mes en curso (en CLP): suma del IVA de los pagos
 * (`paid_at` o `due_date`) que caen en el mes de `today`. Derivado con
 * `breakdownFromTotal`, igual que el F29.
 */
function currentMonthIva(payments: readonly StatementPayment[], today: string): number {
  const period = today.slice(0, 7);
  const bucket = groupByF29Period(
    payments.map<F29Payment>((p) => ({
      id: p.id,
      date: p.paid_at ?? p.due_date,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      document_type: p.document_type,
      folio: null,
    })),
  ).find((b) => b.period === period);
  return bucket?.debit ?? 0;
}

// ------------------------------------------------------------- Resumen extra

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Hasta cuándo está pagado (sin cobros automáticos: el cliente renueva). */
function paidUntil(m: Membership | undefined): string {
  if (!m) return "…";
  if (m.state === "sin_plan") return "Sin plan vigente";
  if (m.state === "finalizado") return "Finalizado";
  if (m.state === "pago_unico") return "Pago único (sin vencimiento)";
  return m.coveredUntil ? fmtDay(m.coveredUntil) : "—";
}

/** Método del último pago confirmado: Flow o registro manual (sin proveedor). */
function paymentMethod(payments: readonly StatementPayment[]): string {
  const last = payments.find((p) => p.status === "paid");
  if (!last) return "Sin pagos aún";
  return last.provider === "flow" ? "Flow (link de pago)" : "Registro manual";
}

function AccountSummaryCard({
  clientId,
  membership,
  payments,
  paymentsLoading,
}: {
  clientId: string;
  membership: Loadable<Membership>;
  payments: readonly StatementPayment[];
  paymentsLoading: boolean;
}) {
  const m = membership.data;
  const openCount = payments.filter((p) => p.status === "pending" || p.status === "overdue").length;
  return (
    <Panel
      title="Cuenta"
      icon={Wallet}
      description="Derivado de los pagos confirmados; no se edita a mano."
      actions={
        <Link
          to="/clients/$clientId/facturacion"
          params={{ clientId }}
          search={{ tab: "cobros" }}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver cobros <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      }
    >
      {membership.loading ? (
        <ListSkeleton rows={4} label="Cargando cuenta" />
      ) : membership.error ? (
        <ErrorState message={membership.error} onRetry={membership.retry} />
      ) : (
        <dl className="flex flex-col">
          <Row label="Plan actual">
            {m && m.state !== "sin_plan" ? (findPlan(m.planKey)?.label ?? "Sin plan") : "Sin plan"}
          </Row>
          <Row label="MRR neto">
            <Money amount={m ? membershipMrr(m) : 0} />
          </Row>
          <Row label="Pagado hasta">{paidUntil(m)}</Row>
          <Row label="Cobros abiertos">
            {paymentsLoading ? "…" : openCount === 0 ? "Ninguno" : openCount}
          </Row>
          <Row label="Método de pago">{paymentsLoading ? "…" : paymentMethod(payments)}</Row>
          <Row label="Cliente desde">{m?.clientSince ? fmtDay(m.clientSince) : "—"}</Row>
        </dl>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- Documentos

function documentConcept(p: StatementPayment): string {
  const plan = findPlan(p.plan_key);
  if (plan && p.period_start && p.period_end) {
    return `${plan.label} · ${fmtDay(p.period_start)} – ${fmtDay(p.period_end)}`;
  }
  const base = p.description?.trim() || "Cobro";
  return p.period ? `${base} · ${fmtMonth(p.period)}` : base;
}

function TaxDocumentsPanel({
  clientId,
  documents,
  loading,
  error,
  onRetry,
  today,
  canEdit,
}: {
  clientId: string;
  documents: readonly StatementPayment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  today: string;
  canEdit: boolean;
}) {
  return (
    <Panel
      title="Documentos tributarios"
      icon={Receipt}
      description="Boletas y facturas en PDF subidas a cada cobro."
    >
      {loading ? (
        <ListSkeleton rows={3} label="Cargando documentos" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : documents.length === 0 ? (
        <EmptyState
          size="compact"
          icon={FileText}
          title="Aún no hay boletas ni facturas"
          description={
            canEdit
              ? "Súbelas desde el menú «⋯» de cada cobro pagado, en Cobros."
              : "Cuando la agencia suba una boleta o factura aparecerá aquí."
          }
          action={
            <Link
              to="/clients/$clientId/facturacion"
              params={{ clientId }}
              search={{ tab: "cobros" }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ir a Cobros <ArrowRight aria-hidden className="h-3 w-3" />
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {documents.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {paymentDocumentLabel(p.document_type)} · {documentConcept(p)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <Money amount={p.amount} currency={p.currency} className="text-foreground" />
                  {p.paid_at ? ` · pagado el ${fmtDay(p.paid_at)}` : ""}
                </p>
              </div>
              <StatusBadge status={displayStatus(p, today)} />
              <DocumentButton payment={p} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
