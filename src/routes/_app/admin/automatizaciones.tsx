import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton, PageContainer, PageHeader } from "@/components/app";
import {
  AutomationsStatusPanel,
  useAutomationsStatus,
} from "@/components/automations/automations-status";
import { useIsPlatformAdmin } from "@/lib/auth/platformAdmin.functions";

export const Route = createFileRoute("/_app/admin/automatizaciones")({
  component: AutomationsPage,
  head: () => ({
    meta: [
      { title: "Automatizaciones · Vibranding" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const BREADCRUMB = [
  { label: "Salud", to: "/admin/health" },
  { label: "Automatizaciones" },
] as const;

/** Estado de las tareas automáticas: solo administradores de plataforma (el servidor también lo exige). */
function AutomationsPage() {
  const admin = useIsPlatformAdmin();
  if (admin.isPending) {
    return (
      <PageContainer>
        <ListSkeleton rows={4} label="Comprobando permisos" />
      </PageContainer>
    );
  }
  if (admin.isError) {
    return (
      <PageContainer>
        <ErrorState
          message="No pudimos comprobar tus permisos."
          onRetry={() => void admin.refetch()}
          retrying={admin.isFetching}
        />
      </PageContainer>
    );
  }
  if (!admin.data) {
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldAlert}
          title="Solo para administradores"
          description="El estado de las automatizaciones está disponible solo para los administradores de la plataforma."
        />
      </PageContainer>
    );
  }
  return <AutomationsContent />;
}

function AutomationsContent() {
  const query = useAutomationsStatus(true);
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        breadcrumb={BREADCRUMB}
        title="Automatizaciones"
        description="Lo que la plataforma hace sola cada día: cuándo corrió por última vez y si salió bien. Horarios en hora de Chile."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        }
      />
      <AutomationsStatusPanel />
    </PageContainer>
  );
}
