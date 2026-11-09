import { createFileRoute } from "@tanstack/react-router";
import { EmpresaPanel, isEmpresaTab, type EmpresaTab } from "@/components/mi-agencia/Empresa";
import { MiAgenciaPage } from "@/components/mi-agencia/MiAgenciaShell";
import { MiAgenciaOrgGate, useMiAgenciaOrg } from "@/components/mi-agencia/useMiAgenciaOrg";

interface EmpresaSearch {
  tab?: EmpresaTab;
}

export const Route = createFileRoute("/_app/mi-agencia/empresa")({
  validateSearch: (s: Record<string, unknown>): EmpresaSearch => ({
    tab: isEmpresaTab(s.tab) ? s.tab : undefined,
  }),
  head: () => ({ meta: [{ title: "Empresa · Mi agencia | Vibranding" }] }),
  component: EmpresaRoute,
});

function EmpresaRoute() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { org, canManage } = useMiAgenciaOrg();
  const currentTab: EmpresaTab = tab ?? "resumen";
  return (
    <MiAgenciaPage
      section="empresa"
      title="Empresa"
      description="Datos legales, cuentas bancarias y facturación de la agencia."
    >
      <MiAgenciaOrgGate org={org}>
        {(data) => (
          <EmpresaPanel
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
