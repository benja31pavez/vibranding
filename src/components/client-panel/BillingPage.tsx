import { BillingSection } from "@/components/portal/BillingSection";
import { usePortalSnapshot, type PortalMode } from "@/components/portal/usePortal";
import { PortalSectionPage } from "./PortalSectionPage";

/** Plan y pagos del portal (vista portal_payments, sin datos internos). */
const CLIENT_MODE: PortalMode = { kind: "client" };

export function BillingPage() {
  const snapshot = usePortalSnapshot(CLIENT_MODE);
  const data = snapshot.data?.status === "ok" ? snapshot.data.snapshot : undefined;
  return (
    <PortalSectionPage title="Facturación">
      <BillingSection
        readOnly={false}
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
