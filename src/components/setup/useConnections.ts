import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getSetupStatus } from "@/lib/meta/setup.functions";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { HIDDEN_SECTIONS } from "@/lib/clientSections";
import { adsBillingRows } from "@/lib/ads-billing/combined";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { useAdsBillingSources } from "@/components/clients/ficha/AdsBillingPanel";
import { useGoogleAdsOverview } from "@/components/google-ads/googleAdsOverviewQueries";
import { useGoogleAdsBilling } from "@/components/google-ads/googleAdsBillingQueries";
import type { WAAccount } from "@/components/pages/ChatbotPage";
import { buildConnections } from "./connectionModel";

/** Planes que incluyen Meta Ads (cuenta publicitaria e ingesta de anuncios). */
const PLANS_WITH_ADS: readonly string[] = ["crecimiento"];

export const setupStatusKey = (clientId: string) => ["setup-status", clientId] as const;

/** Todo lo que necesitan el resumen y cada conexión, leído en paralelo. */
export function useConnections(clientId: string) {
  const userKey = useUserKey();
  const capsState = useClientCapabilities(clientId);
  const { caps } = capsState;
  const fetchStatus = useServerFn(getSetupStatus);

  const status = useQuery({
    queryKey: setupStatusKey(clientId),
    queryFn: () => fetchStatus({ data: { clientId } }),
  });
  const plan = useQuery({
    queryKey: ["client-plan", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_billing")
        .select("plan_key")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.plan_key ?? null;
    },
  });
  // Misma lectura que la sección WhatsApp: la vista segura no expone tokens.
  const whatsapp = useQuery({
    queryKey: ["setup-whatsapp", userKey, clientId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("whatsapp_accounts_safe" as any) as any)
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as WAAccount | null;
    },
  });
  const google = useGoogleAdsOverview(clientId);
  const googleBilling = useGoogleAdsBilling(clientId);
  const adsBilling = useAdsBillingSources(clientId);

  // Conectar o vincular desde una tarjeta invalida las capacidades: el detalle se relee.
  const { refetch: refetchStatus } = status;
  useEffect(() => {
    void refetchStatus();
  }, [caps.meta_connected, caps.has_ad_account, caps.has_instagram, refetchStatus]);

  const planKey = plan.data ?? null;
  const metaBillingRow = adsBilling.data
    ? adsBillingRows(adsBilling.data).find((r) => r.platform === "meta")
    : undefined;
  const wa = whatsapp.data ?? null;

  const connections = buildConnections({
    caps,
    account: status.data?.account ?? null,
    instagram: status.data?.instagram ?? null,
    adsIncluded: !planKey || PLANS_WITH_ADS.includes(planKey),
    whatsapp: whatsapp.isSuccess
      ? {
          exists: wa !== null,
          connected: Boolean(wa?.connected),
          displayPhone: wa?.display_phone_number ?? null,
          phoneNumberId: wa?.phone_number_id ?? null,
        }
      : null,
    whatsappFailed: Boolean(whatsapp.error),
    showOutcomes: !HIDDEN_SECTIONS.has("analytics"),
    google: google.data ?? null,
    googleFailed: Boolean(google.error),
    googleBillingVerdict: googleBilling.data?.verdict ?? null,
    metaBillingState: metaBillingRow?.state ?? null,
  });

  const refreshMeta = async () => {
    await Promise.all([capsState.reload(), status.refetch(), adsBilling.refetch()]);
  };

  return {
    connections,
    caps,
    status,
    plan,
    whatsapp,
    google,
    googleBilling,
    adsBilling,
    capsState,
    refreshMeta,
    /** Lo mínimo para dibujar estados sin "parpadeo" de Pendiente → Conectado. */
    loading: capsState.loading || status.isLoading || plan.isLoading,
    loadError: status.error ?? capsState.error ?? plan.error ?? null,
  };
}

export type ConnectionsState = ReturnType<typeof useConnections>;
