import { useState } from "react";
import { LineChart, UserX } from "lucide-react";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app";
import { pendingCount, type PortalSnapshot } from "@/lib/portal/model";
import { ApprovalsSection } from "./ApprovalsSection";
import { BillingSection } from "./BillingSection";
import { CalendarSection } from "./CalendarSection";
import { PortalNav } from "./PortalNav";
import { ProposalsSection } from "./ProposalsSection";
import { ResultsSection } from "./ResultsSection";
import { errorMessage, usePortalSnapshot, type PortalMode } from "./usePortal";

/**
 * Portal del cliente v2. Lo usa el cliente (/portal) y el equipo en la vista
 * previa (/clients/$clientId/portal-preview, solo lectura). Mobile-first.
 */
export function PortalView({ mode }: { mode: PortalMode }) {
  const snapshot = usePortalSnapshot(mode);
  const result = snapshot.data;

  if (snapshot.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tu portal"
        message={errorMessage(snapshot.error)}
        onRetry={() => void snapshot.refetch()}
        retrying={snapshot.isFetching}
      />
    );
  }

  if (result?.status === "no_client") {
    return (
      <EmptyState
        icon={UserX}
        title="Tu cuenta aún no está vinculada a una marca"
        description="Escríbele a tu equipo de Vibranding para que te dé acceso. Apenas lo hagan, verás todo aquí."
      />
    );
  }

  const data: PortalSnapshot | undefined = result?.status === "ok" ? result.snapshot : undefined;
  const loading = snapshot.isPending;
  const retry = () => void snapshot.refetch();
  const retrying = snapshot.isFetching;
  const pending = pendingCount(data?.approvals);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {data?.clientName ? `Hola, ${data.clientName}` : "Tu portal"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? "Preparando tu resumen…"
            : pending > 0
              ? "Tienes cosas esperando tu OK. Empieza por ahí."
              : "Todo al día. Aquí tienes cómo va tu marca."}
        </p>
      </div>

      <PortalNav pending={pending} />

      <ApprovalsSection
        mode={mode}
        loading={loading}
        result={data?.approvals}
        onRetry={retry}
        retrying={retrying}
      />
      <CalendarSection mode={mode} enabled={Boolean(data)} />
      <ResultsSection loading={loading} result={data?.report} onRetry={retry} retrying={retrying} />
      <BillingSection
        readOnly={mode.kind === "preview"}
        loading={loading}
        result={data?.billing}
        onRetry={retry}
        retrying={retrying}
      />
      <ProposalsSection
        loading={loading}
        result={data?.proposals}
        onRetry={retry}
        retrying={retrying}
      />
      {loading ? (
        <ListSkeleton rows={2} label="Cargando analítica" />
      ) : (
        data && <DetailedAnalytics clientId={data.clientId} />
      )}
    </div>
  );
}

/** Analítica detallada (la del portal anterior), plegada para no recargar el inicio. */
function DetailedAnalytics({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      id="analitica"
      className="scroll-mt-28 rounded-app-lg border border-border-subtle bg-surface shadow-app-xs"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold">
        <LineChart aria-hidden className="h-4 w-4 text-muted-foreground" /> Analítica detallada
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {open ? "Ocultar" : "Ver"}
        </span>
      </summary>
      {open && (
        <div className="border-t border-border-subtle p-4">
          <AnalyticsDashboard clientId={clientId} />
        </div>
      )}
    </details>
  );
}
