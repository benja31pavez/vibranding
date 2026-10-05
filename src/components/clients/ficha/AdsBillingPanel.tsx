import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState, ListSkeleton, Panel, StatusBadge, type StatusTone } from "@/components/app";
import {
  ADS_BILLING_STATE_LABEL,
  ADS_PLATFORM_LABEL,
  adsBillingRows,
  type AdsBillingSources,
  type AdsBillingState,
} from "@/lib/ads-billing/combined";
import { normalizeAdAccountId } from "@/lib/ads-billing/metaStatus";
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
 * "Pago de pauta": el cliente paga la publicidad con su tarjeta. Combina lo
 * declarado en el onboarding con la verificación automática por plataforma.
 */
export function AdsBillingPanel({ clientId }: { clientId: string }) {
  const userKey = useUserKey();
  const query = useQuery({
    queryKey: ["ficha", userKey, clientId, "ads-billing"],
    queryFn: () => loadSources(clientId),
    staleTime: 5 * 60_000,
  });

  return (
    <Panel title="Pago de pauta" icon={CreditCard}>
      {query.isLoading ? (
        <ListSkeleton rows={2} label="Cargando pago de pauta" />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data ? (
        <ul className="space-y-2.5">
          {adsBillingRows(query.data).map((row) => (
            <li key={row.platform} className="flex items-start justify-between gap-3 text-sm">
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
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
