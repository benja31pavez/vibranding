import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientCapabilities {
  meta_connected: boolean;
  has_ad_account: boolean;
  has_instagram: boolean;
  has_whatsapp: boolean;
  has_ad_data: boolean;
  has_outcomes: boolean;
}

export const EMPTY_CAPABILITIES: ClientCapabilities = {
  meta_connected: false,
  has_ad_account: false,
  has_instagram: false,
  has_whatsapp: false,
  has_ad_data: false,
  has_outcomes: false,
};

/** Everything the sidebar and the setup wizard derive from the database. */
export async function loadClientCapabilities(clientId: string): Promise<ClientCapabilities> {
  const [meta, wa, ads, outcomes] = await Promise.all([
    (supabase.from("meta_accounts" as any) as any)
      .select("connected,token_secret_id,ad_account_id,ig_account_id")
      .eq("client_id", clientId)
      .maybeSingle(),
    (supabase.from("whatsapp_accounts_safe" as any) as any)
      .select("connected")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("ad_insights_daily")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("conversation_outcomes")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);

  const m = meta.data ?? null;
  return {
    meta_connected: Boolean(m?.connected && m?.token_secret_id),
    has_ad_account: Boolean(m?.ad_account_id),
    has_instagram: Boolean(m?.ig_account_id),
    has_whatsapp: Boolean(wa.data?.connected),
    has_ad_data: (ads.count ?? 0) > 0,
    has_outcomes: (outcomes.count ?? 0) > 0,
  };
}

export function useClientCapabilities(clientId: string | null) {
  const [caps, setCaps] = useState<ClientCapabilities>(EMPTY_CAPABILITIES);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!clientId) {
      setCaps(EMPTY_CAPABILITIES);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCaps(await loadClientCapabilities(clientId));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { caps, loading, reload };
}
