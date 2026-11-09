import { createFileRoute } from "@tanstack/react-router";
import { FinanzasPanel, isFinanzasTab, type FinanzasTab } from "@/components/mi-agencia/Finanzas";
import { MiAgenciaPage } from "@/components/mi-agencia/MiAgenciaShell";
import { MiAgenciaOrgGate, useMiAgenciaOrg } from "@/components/mi-agencia/useMiAgenciaOrg";

interface FinanzasSearch {
  tab?: FinanzasTab;
}

export const Route = createFileRoute("/_app/mi-agencia/finanzas")({
  validateSearch: (s: Record<string, unknown>): FinanzasSearch => ({
    tab: isFinanzasTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({ meta: [{ title: "Finanzas · Mi agencia | Vibranding" }] }),
  component: FinanzasRoute,
});

function FinanzasRoute() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { org, canManage } = useMiAgenciaOrg();
  const currentTab: FinanzasTab = tab ?? "resumen";
  return (
    <MiAgenciaPage
      section="finanzas"
      title="Finanzas"
      description="MRR, ingresos y gastos de la agencia, con el apoyo para preparar el F29."
    >
      <MiAgenciaOrgGate org={org}>
        {(data) => (
          <FinanzasPanel
            org={data}
            canManage={canManage}
            tab={currentTab}
            onTabChange={(next) =>
              navigate({
                search: () => ({ tab: next === "resumen" ? undefined : next }),
                replace: true,
                resetScroll: false,
              })
            }
          />
        )}
      </MiAgenciaOrgGate>
    </MiAgenciaPage>
  );
}
