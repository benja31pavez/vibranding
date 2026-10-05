import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CreditCard, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdsBillingMessageDialog } from "@/components/alerts/AdsBillingMessageDialog";
import { CardUpdateDialog } from "@/components/google-ads/CardUpdateDialog";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState, ListSkeleton, Panel, StatusBadge, type StatusTone } from "@/components/app";
import {
  ADS_BILLING_STATE_LABEL,
  ADS_PLATFORM_LABEL,
  adsBillingRows,
  type AdsBillingSources,
  type AdsPlatform,
  type AdsBillingState,
} from "@/lib/ads-billing/combined";
import { evaluateMetaBilling, normalizeAdAccountId } from "@/lib/ads-billing/metaStatus";
import { useUserKey } from "./fichaQueries";

const TONE: Readonly<Record<AdsBillingState, StatusTone>> = {
  verificado: "success",
  pendiente: "warning",
  rechazado: "danger",
  sin_cuenta: "neutral",
};

type Row = Record<string, unknown>;
// Tablas nuevas (meta_billing_status, google_ads_billing_status) aún no están
// en los tipos generados: se leen sin tipar y de forma tolerante.
const untyped = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        limit: (n: number) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
      };
    };
  };
};

/** Primera fila de una tabla opcional; si la tabla no existe (migración sin aplicar) → null. */
async function optionalRows(table: string, clientId: string): Promise<Row[]> {
  const { data, error } = await untyped.from(table).select("*").eq("client_id", clientId).limit(10);
  if (error) {
    console.warn(`[pago de pauta] ${table} no disponible`, error.message);
    return [];
  }
  return data ?? [];
}

/** "123-456-7890" → "1234567890"; null si no queda nada. */
const digitsOnly = (v: unknown): string | null => {
  const d = typeof v === "string" ? v.replace(/\D/g, "") : "";
  return d || null;
};

const newestFirst = (a: Row, b: Row) =>
  String(b.checked_at ?? b.updated_at ?? "").localeCompare(
    String(a.checked_at ?? a.updated_at ?? ""),
  );

async function loadSources(clientId: string): Promise<AdsBillingSources> {
  const [intake, meta, google, metaStatus, googleStatus] = await Promise.all([
    supabase.from("client_intake").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("meta_accounts")
      .select("ad_account_id,connected")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("google_ads_accounts")
      .select("customer_id,status")
      .eq("client_id", clientId)
      .maybeSingle(),
    optionalRows("meta_billing_status", clientId),
    optionalRows("google_ads_billing_status", clientId),
  ]);
  if (intake.error) throw new Error(intake.error.message);
  if (meta.error) throw new Error(meta.error.message);
  if (google.error) console.warn("[pago de pauta] google_ads_accounts", google.error.message);

  const metaAdAccountId = meta.data?.connected
    ? normalizeAdAccountId(meta.data.ad_account_id)
    : null;
  // Google solo cuenta si la cuenta está conectada; el chequeo debe ser de esa misma cuenta.
  const googleCustomerId =
    google.data?.status === "conectada" ? digitsOnly(google.data.customer_id) : null;
  const metaRow = metaStatus
    .filter((r) => r.ad_account_id === metaAdAccountId)
    .sort(newestFirst)[0];
  return {
    intake: (intake.data as Row | null) ?? null,
    metaAdAccountId,
    metaStatus: metaRow
      ? {
          account_status:
            typeof metaRow.account_status === "number" ? metaRow.account_status : null,
          has_funding: typeof metaRow.has_funding === "boolean" ? metaRow.has_funding : null,
        }
      : null,
    googleCustomerId,
    googleStatus: googleCustomerId
      ? (googleStatus
          .filter((r) => digitsOnly(r.customer_id) === googleCustomerId)
          .sort(newestFirst)[0] ?? null)
      : null,
  };
}

/**
 * "Pago de pauta" (único panel de la ficha): el cliente paga la publicidad con
 * su tarjeta. Una fila por plataforma con el estado combinado (declarado en el
 * onboarding + verificación automática) y, si hay un problema, el mensaje
 * listo para el cliente. El detalle de Google vive en la sección Google Ads.
 */
/** Fuentes del pago de pauta (compartido por el panel y el resumen de la ficha). */
export function useAdsBillingSources(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["ficha", userKey, clientId, "ads-billing"],
    queryFn: () => loadSources(clientId),
    staleTime: 5 * 60_000,
  });
}

/** Tono de cada estado (para el panel y el resumen). */
export const ADS_BILLING_TONE = TONE;

export function AdsBillingPanel({
  clientId,
  clientName,
  canEdit,
}: {
  clientId: string;
  clientName: string;
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<AdsPlatform | null>(null);
  const query = useAdsBillingSources(clientId);
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
