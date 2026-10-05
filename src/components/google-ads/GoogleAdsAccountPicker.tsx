import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, ListSkeleton } from "@/components/app";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { formatCustomerId } from "@/lib/google-ads/gaql";
import {
  listGoogleAdsCustomers,
  type CustomerSource,
  type GoogleAdsCustomerChoice,
} from "@/lib/google-ads/connection.functions";

function unavailableReason(c: GoogleAdsCustomerChoice): string | null {
  if (c.isManager) return "Cuenta administradora (MCC)";
  if (c.takenBy) return `Vinculada a ${c.takenBy}`;
  if (c.currency !== "CLP") return `Factura en ${c.currency ?? "otra moneda"}`;
  return null;
}

/**
 * Cuentas para elegir cuál es de este cliente: las de la MCC de la agencia
 * (source "agencia") o las accesibles con el token propio del cliente ("cliente").
 */
export function GoogleAdsAccountPicker({
  clientId,
  currentCustomerId,
  busy,
  source,
  onPick,
}: {
  clientId: string;
  currentCustomerId: string | null;
  busy: boolean;
  source: CustomerSource;
  onPick: (customerId: string) => void;
}) {
  const userKey = useUserKey();
  const listCustomers = useServerFn(listGoogleAdsCustomers);
  const query = useQuery({
    queryKey: ["google-ads-customers", userKey, clientId, source],
    queryFn: () => listCustomers({ data: { clientId, source } }),
    staleTime: 60_000,
  });

  if (query.isLoading) return <ListSkeleton rows={3} label="Buscando cuentas de Google Ads" />;
  if (query.error) {
    return (
      <ErrorState
        title="No pudimos listar las cuentas"
        message={(query.error as Error).message}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  const customers = query.data?.customers ?? [];
  if (customers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {source === "agencia"
          ? "La MCC de la agencia todavía no tiene cuentas de clientes vinculadas. Vincula la cuenta del cliente a la MCC en Google Ads y vuelve aquí."
          : "La cuenta de Google conectada no tiene acceso a cuentas de Google Ads."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border-subtle rounded-app-md border border-border-subtle">
        {customers.map((c) => {
          const reason = unavailableReason(c);
          const isCurrent = c.customerId === currentCustomerId;
          return (
            <li key={c.customerId} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name ?? "Sin nombre"}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatCustomerId(c.customerId)}
                  {c.managerId && ` · vía MCC ${formatCustomerId(c.managerId)}`}
                </div>
              </div>
              {reason ? (
                <Badge variant="outline">{reason}</Badge>
              ) : (
                <Button
                  size="sm"
                  variant={isCurrent ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => onPick(c.customerId)}
                >
                  {isCurrent ? "Confirmar esta cuenta" : "Usar esta cuenta"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {(query.data?.warnings ?? []).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Algunas cuentas no se pudieron revisar: {query.data?.warnings.join(" · ")}
        </p>
      )}
    </div>
  );
}
