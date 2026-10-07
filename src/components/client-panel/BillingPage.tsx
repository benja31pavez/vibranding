import { BillingSection } from "@/components/portal/BillingSection";
import { portalModeFor, usePortalSnapshot } from "@/components/portal/usePortal";
import { usePanelMode } from "./panelMode";
import { PortalSectionPage } from "./PortalSectionPage";

/** Plan y pagos del portal (vista portal_payments, sin datos internos). Vista previa: solo lectura. */
export function BillingPage() {
  const { preview } = usePanelMode();
  const snapshot = usePortalSnapshot(portalModeFor(preview));
  const data = snapshot.data?.status === "ok" ? snapshot.data.snapshot : undefined;
  return (
    <PortalSectionPage title="Facturación">
      <BillingSection
        readOnly={Boolean(preview)}
        loading={snapshot.isPending}
        result={
          snapshot.isError || snapshot.data?.status === "no_client"
            ? { ok: false, error: "No pudimos cargar tus pagos." }
            : data?.billing
        }
        onRetry={() => void snapshot.refetch()}
        retrying={snapshot.isFetching}
      />
    </PortalSectionPage>
  );
}
