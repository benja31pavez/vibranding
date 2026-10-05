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
    <div className="space-y-5 md:space-y-6">
      <div>
        <h1 className="text-balance font-display text-[1.625rem] font-semibold leading-tight tracking-tight md:text-4xl">
          {data?.clientName ? `Hola, ${data.clientName}` : "Tu portal"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
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
      className="group scroll-mt-32 rounded-app-lg border border-border-subtle bg-surface shadow-app-xs"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-base font-semibold tracking-tight sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-primary/10 text-primary">
          <LineChart aria-hidden className="h-[18px] w-[18px]" />
        </span>
        Analítica detallada
        <span className="ml-auto text-sm font-medium text-primary">{open ? "Ocultar" : "Ver"}</span>
      </summary>
      {open && (
        <div className="border-t border-border-subtle p-4">
          <AnalyticsDashboard clientId={clientId} />
        </div>
      )}
    </details>
  );
}
