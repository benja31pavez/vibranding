import { createFileRoute } from "@tanstack/react-router";
import { MiAgenciaPage } from "@/components/mi-agencia/MiAgenciaShell";
import { PanelResumen } from "@/components/mi-agencia/PanelResumen";
import { MiAgenciaOrgGate, useMiAgenciaOrg } from "@/components/mi-agencia/useMiAgenciaOrg";

export const Route = createFileRoute("/_app/mi-agencia/")({
  head: () => ({ meta: [{ title: "Mi agencia | Vibranding" }] }),
  component: MiAgenciaIndex,
});

function MiAgenciaIndex() {
  const { org } = useMiAgenciaOrg();
  return (
    <MiAgenciaPage
      section="panel"
      title="Mi agencia"
      description="Resumen de tu agencia: cartera, finanzas, equipo y datos de la empresa."
    >
      <MiAgenciaOrgGate org={org}>{(data) => <PanelResumen org={data} />}</MiAgenciaOrgGate>
    </MiAgenciaPage>
  );
}
