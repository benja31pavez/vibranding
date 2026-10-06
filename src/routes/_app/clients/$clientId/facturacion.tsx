import { createFileRoute, redirect } from "@tanstack/react-router";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { ErrorState, PageHeader } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import { BillingCard } from "@/components/clients/ficha/BillingCard";
import { useFichaOverview } from "@/components/clients/ficha/fichaQueries";

/** Facturación = lo monetario: plan contratado y pagos. Los contratos viven en Legal. */
export const Route = createFileRoute("/_app/clients/$clientId/facturacion")({
  // `tab` se acepta por links antiguos: "contratos" redirige a Legal.
  validateSearch: (s: Record<string, unknown>): { tab?: "contratos" | "pagos" } => ({
    tab: s.tab === "pagos" ? "pagos" : s.tab === "contratos" ? "contratos" : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    if (search.tab === "contratos") {
      throw redirect({ to: "/clients/$clientId/legal", params });
    }
  },
  head: () => ({
    meta: [
      { title: "Facturación del cliente | Vibranding" },
      { name: "description", content: "Pagos y cobros del cliente." },
      { property: "og:title", content: "Facturación del cliente | Vibranding" },
      { property: "og:description", content: "Pagos y cobros del cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturacionPage,
});

function FacturacionPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="space-y-4">
      <PageHeader size="compact" title="Facturación" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <PlanSection clientId={clientId} />
        <PaymentsPanel clientId={clientId} />
      </div>
    </div>
  );
}

/** Plan contratado del cliente (mismo formulario que la gestión): aquí se asigna el plan. */
function PlanSection({ clientId }: { clientId: string }) {
  const overview = useFichaOverview(clientId);
  return (
    <section
      aria-labelledby="plan-contratado"
      className="rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs"
    >
      <h2 id="plan-contratado" className="mb-3 text-sm font-semibold text-foreground">
        Plan contratado
      </h2>
      {overview.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : overview.error || !overview.data ? (
        <ErrorState
          message={overview.error?.message ?? "No pudimos cargar el plan."}
          onRetry={() => overview.refetch()}
        />
      ) : (
        <BillingCard clientId={clientId} overview={overview.data} />
      )}
    </section>
  );
}
