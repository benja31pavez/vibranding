import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { CompactStats, FitPage, MoneyTotals, PageHeader } from "@/components/app";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { invalidateClientHealth } from "@/components/clients/health/healthKeys";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { todayInChile } from "@/lib/billing/dates";
import { useFlowConfigured } from "@/lib/flow/config.functions";
import type { Membership } from "@/lib/billing/membership";
import { useMembership } from "@/lib/billing/membership.functions";
import { AddonsCard } from "./AddonsCard";
import { PlanStatementCard } from "./PlanStatementCard";
import type { FlowState } from "./PaymentActions";
import {
  sortForStatement,
  summarize,
  usePayments,
  useReloadStatement,
  useStatementAccess,
  type StatementAccess,
  type StatementPayment,
} from "./statementData";

const READ_ONLY: StatementAccess = { canEdit: false, canManage: false };

/**
 * Facturación = estado de cuenta del cliente: su plan (derivado de sus pagos),
 * lo que debe y lo que pagó. El plan se contrata y renueva aquí, con Flow. Lo ve la agencia y, en el futuro, el propio cliente: sin MRR ni datos
 * internos; las herramientas de la agencia solo aparecen con permiso de edición.
 */
export function StatementPage({ clientId }: { clientId: string }) {
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
  membership: Loadable<Membership>;
  payments: Loadable<StatementPayment[]>;
  access: StatementAccess;
  flow: FlowState;
  flowMissing: string[] | null;
  onChanged: () => void;
}

/** Vista del estado de cuenta (sin consultas): resumen, "Tu plan", "Adicionales" y "Pagos". */
export function StatementView({
  clientId,
  clientName,
  today,
  membership,
  payments,
  access,
  flow,
  flowMissing,
  onChanged,
}: StatementViewProps) {
  const rows = useMemo(() => sortForStatement(payments.data ?? []), [payments.data]);
  const summary = useMemo(() => summarize(rows, today), [rows, today]);

  return (
    <FitPage
      header={<PageHeader size="compact" title="Facturación" />}
      contentClassName="flex flex-col gap-4"
    >
      <CompactStats
        label="Resumen de pagos"
        className="shrink-0"
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
          },
          {
            key: "vencido",
            label: "Vencido",
            icon: AlertCircle,
            loading: payments.loading,
            tone: summary.overdue.clp > 0 ? "danger" : "default",
            value: <MoneyTotals totals={summary.overdue} />,
          },
        ]}
      />
      <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:items-start xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <PlanStatementCard
          clientId={clientId}
          membership={membership.data}
          loading={membership.loading}
          error={membership.error}
          onRetry={membership.retry}
          flow={flow}
          canPay={access.canEdit}
        />
        <div className="flex min-w-0 flex-col gap-4 md:h-full md:min-h-0">
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
        </div>
      </div>
    </FitPage>
  );
}
