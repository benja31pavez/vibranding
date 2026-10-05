import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CreditCard, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdsBillingMessageDialog } from "@/components/alerts/AdsBillingMessageDialog";
import { CardUpdateDialog } from "@/components/google-ads/CardUpdateDialog";
import { ErrorState, ListSkeleton, Panel, StatusBadge, type StatusTone } from "@/components/app";
import {
  ADS_BILLING_STATE_LABEL,
  ADS_PLATFORM_LABEL,
  adsBillingRows,
  type AdsPlatform,
  type AdsBillingState,
} from "@/lib/ads-billing/combined";
import { evaluateMetaBilling } from "@/lib/ads-billing/metaStatus";
import { loadAdsBillingSources } from "./adsBillingSources";
import { useUserKey } from "./fichaQueries";

const TONE: Readonly<Record<AdsBillingState, StatusTone>> = {
  verificado: "success",
  pendiente: "warning",
  rechazado: "danger",
  sin_cuenta: "neutral",
};

/**
 * "Pago de pauta" (único panel de la ficha): el cliente paga la publicidad con
 * su tarjeta. Una fila por plataforma con el estado combinado (declarado en el
 * onboarding + verificación automática) y, si hay un problema, el mensaje
 * listo para el cliente. El detalle de Google vive en la sección Google Ads.
 */
export function AdsBillingPanel({
  clientId,
  clientName,
  canEdit,
}: {
  clientId: string;
  clientName: string;
  canEdit: boolean;
}) {
  const userKey = useUserKey();
  const [dialog, setDialog] = useState<AdsPlatform | null>(null);
  const query = useQuery({
    queryKey: ["ficha", userKey, clientId, "ads-billing"],
    queryFn: () => loadAdsBillingSources(clientId),
    staleTime: 5 * 60_000,
  });
  const rows = query.data ? adsBillingRows(query.data) : [];
  const metaReason = query.data?.metaStatus
    ? evaluateMetaBilling(query.data.metaStatus).reason
    : "no_funding";
  const googleVerdict =
    typeof query.data?.googleStatus?.verdict === "string" ? query.data.googleStatus.verdict : null;
  // Google: también "pendiente" según su propio chequeo (igual que su panel en la sección Google Ads).
  const needsNotice = (platform: AdsPlatform, state: AdsBillingState) =>
    state === "rechazado" || (platform === "google" && googleVerdict === "pendiente");

  return (
    <Panel
      title="Pago de pauta"
      icon={CreditCard}
      tone={rows.some((r) => r.state === "rechazado") ? "warning" : "default"}
    >
      {query.isLoading ? (
        <ListSkeleton rows={2} label="Cargando pago de pauta" />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <li key={row.platform} className="space-y-1.5 py-2.5 text-sm first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{ADS_PLATFORM_LABEL[row.platform]}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.chosen === false && row.state === "sin_cuenta"
                      ? "El cliente no la eligió en el onboarding."
                      : row.hint}
                  </p>
                </div>
                <StatusBadge
                  status={row.state}
                  label={ADS_BILLING_STATE_LABEL[row.state]}
                  tone={TONE[row.state]}
                  className="shrink-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {canEdit && needsNotice(row.platform, row.state) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary"
                    onClick={() => setDialog(row.platform)}
                  >
                    <MessageSquareText aria-hidden className="h-3 w-3" />
                    Avisar al cliente
                  </Button>
                )}
                {row.state !== "sin_cuenta" && (
                  <Link
                    to={
                      row.platform === "google"
                        ? "/clients/$clientId/google-ads"
                        : "/clients/$clientId/meta-ads"
                    }
                    params={{ clientId }}
                    className="text-primary hover:underline"
                  >
                    Ver detalle
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog === "meta" && (
        <AdsBillingMessageDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          clientId={clientId}
          clientName={clientName || "tu negocio"}
          reason={metaReason}
          adAccountId={query.data?.metaAdAccountId ?? null}
        />
      )}
      {dialog === "google" && (
        <CardUpdateDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          clientId={clientId}
          verdict={googleVerdict}
        />
      )}
    </Panel>
  );
}
