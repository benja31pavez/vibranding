import { createFileRoute } from "@tanstack/react-router";
import { EquipoPanel, isEquipoTab, type EquipoTab } from "@/components/mi-agencia/Equipo";
import { MiAgenciaPage } from "@/components/mi-agencia/MiAgenciaShell";
import { MiAgenciaOrgGate, useMiAgenciaOrg } from "@/components/mi-agencia/useMiAgenciaOrg";

interface EquipoSearch {
  tab?: EquipoTab;
}

export const Route = createFileRoute("/_app/mi-agencia/equipo")({
  validateSearch: (s: Record<string, unknown>): EquipoSearch => ({
    tab: isEquipoTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({ meta: [{ title: "Equipo · Mi agencia | Vibranding" }] }),
  component: EquipoRoute,
});

function EquipoRoute() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { org, canManage } = useMiAgenciaOrg();
  const currentTab: EquipoTab = tab ?? "resumen";
  return (
    <MiAgenciaPage
      section="equipo"
      title="Equipo"
      description="Miembros de la agencia, roles y fichas de recursos humanos."
    >
      <MiAgenciaOrgGate org={org}>
        {(data) => (
          <EquipoPanel
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
