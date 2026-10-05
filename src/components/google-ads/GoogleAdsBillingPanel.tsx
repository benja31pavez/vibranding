import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton, Panel } from "@/components/app";
import { useGoogleAdsBilling } from "@/components/google-ads/googleAdsBillingQueries";
import { formatMoney } from "@/lib/pricing/plans";
import { GOOGLE_ADS_BILLING_URL } from "@/lib/google-ads/billing";
import { GoogleAdsBillingChip } from "@/components/google-ads/GoogleAdsBillingChip";
import { CardUpdateDialog } from "@/components/google-ads/CardUpdateDialog";

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" });

/**
 * Medio de pago de la cuenta de Google Ads del cliente (paga el cliente con su
 * tarjeta), presupuesto de cuenta si existe y acción para pedirle actualizarla.
 * `compact`: versión para la ficha, con link a la sección Google Ads.
 */
export function GoogleAdsBillingPanel({
  clientId,
  canEdit = true,
  compact = false,
}: {
  clientId: string;
  canEdit?: boolean;
  compact?: boolean;
}) {
  const billing = useGoogleAdsBilling(clientId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (billing.isLoading) return <ListSkeleton rows={2} label="Revisando pago de Google Ads" />;
  if (billing.error) {
    return (
      <ErrorState
        title="No pudimos leer el pago de Google Ads"
        message={(billing.error as Error).message}
        onRetry={() => void billing.refetch()}
        retrying={billing.isFetching}
      />
    );
  }
  const b = billing.data;
  const verdict = b?.verdict ?? "sin_cuenta";
  const needsAction = verdict === "pendiente" || verdict === "rechazado";

  return (
    <Panel
      icon={CreditCard}
      title="Pago de pauta en Google Ads"
      tone={needsAction ? "warning" : "default"}
      actions={<GoogleAdsBillingChip verdict={verdict} />}
    >
      <div className="space-y-2 text-sm">
        {!b || verdict === "sin_cuenta" ? (
          <p className="text-muted-foreground">
            Sin cuenta de Google Ads vinculada. El cliente paga su pauta con su propia tarjeta en su
            cuenta.
          </p>
        ) : (
          <>
            {b.detail && <p>{b.detail}</p>}
            {b.payments_account_name && (
              <p className="text-muted-foreground">Perfil de pagos: {b.payments_account_name}</p>
            )}
            {!compact && (
              <p className="text-muted-foreground">
                {b.budget_limit_clp != null
                  ? `Presupuesto de cuenta: ${formatMoney(b.budget_served_clp ?? 0)} gastado de ${formatMoney(b.budget_limit_clp)}${b.budget_end_at ? ` (hasta ${b.budget_end_at.slice(0, 10)})` : ""}.`
                  : "Sin presupuesto de cuenta (tope) configurado en Google Ads. Recomendado: definir un tope mensual en la cuenta del cliente para acotar el gasto."}
              </p>
            )}
            {b.check_error && (
              <p className="text-xs text-danger-strong" role="alert">
                Último chequeo con error: {b.check_error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Revisado el {DATE_FMT.format(new Date(b.checked_at))}. Se revisa cada mañana.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {needsAction && canEdit && (
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              Pedir actualizar tarjeta
            </Button>
          )}
          {needsAction && (
            <Button asChild size="sm" variant="ghost">
              <a href={GOOGLE_ADS_BILLING_URL} target="_blank" rel="noopener noreferrer">
                Facturación en Google Ads <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
              </a>
            </Button>
          )}
          {compact && (
            <Button asChild size="sm" variant="ghost">
              <Link to="/clients/$clientId/google-ads" params={{ clientId }}>
                Ver Google Ads
              </Link>
            </Button>
          )}
        </div>
      </div>
      <CardUpdateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        verdict={verdict}
      />
    </Panel>
  );
}
