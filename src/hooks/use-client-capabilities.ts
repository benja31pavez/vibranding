import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export interface ClientCapabilities {
  meta_connected: boolean;
  has_ad_account: boolean;
  has_instagram: boolean;
  has_whatsapp: boolean;
  has_ad_data: boolean;
  has_outcomes: boolean;
  /** The ingestion completed at least once, regardless of rows written. */
  ingest_ran: boolean;
}

export const EMPTY_CAPABILITIES: ClientCapabilities = {
  meta_connected: false,
  has_ad_account: false,
  has_instagram: false,
  has_whatsapp: false,
  has_ad_data: false,
  has_outcomes: false,
  ingest_ran: false,
};

/** Everything the sidebar and the setup wizard derive from the database. */
export async function loadClientCapabilities(clientId: string): Promise<ClientCapabilities> {
  const [meta, wa, ads, outcomes] = await Promise.all([
    (supabase.from("meta_accounts" as any) as any)
      .select("connected,token_secret_id,ad_account_id,ig_account_id,last_ingest_at")
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

  // Meta y WhatsApp definen los candados del sidebar: si fallan, mejor mostrar error que "no conectado".
  const failed = [meta, wa, ads, outcomes].find(
    (r: { error?: { message: string } | null }) => r.error,
  );
  if (failed) throw new Error(failed.error.message);

  const m = meta.data ?? null;
  return {
    meta_connected: Boolean(m?.connected && m?.token_secret_id),
    has_ad_account: Boolean(m?.ad_account_id),
    has_instagram: Boolean(m?.ig_account_id),
    has_whatsapp: Boolean(wa.data?.connected),
    has_ad_data: (ads.count ?? 0) > 0,
    has_outcomes: (outcomes.count ?? 0) > 0,
    ingest_ran: Boolean(m?.last_ingest_at),
  };
}

/**
 * Key de React Query por usuario y cliente (no se comparte caché entre sesiones);
 * invalidarla tras conectar Meta/WhatsApp actualiza el sidebar.
 */
export const clientCapabilitiesKey = (userId: string, clientId: string) =>
  ["client-capabilities", userId, clientId] as const;

/** Id del usuario actual para acotar la key ("anon" mientras carga la sesión). */
function useCapabilitiesUserKey(): string {
  const { user } = useAuth();
  return user?.id ?? "anon";
}

export function useClientCapabilities(clientId: string | null) {
  const userKey = useCapabilitiesUserKey();
  const query = useQuery({
    queryKey: clientCapabilitiesKey(userKey, clientId ?? "none"),
    queryFn: () => loadClientCapabilities(clientId as string),
    enabled: Boolean(clientId),
  });
  const { refetch } = query;
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    caps: query.data ?? EMPTY_CAPABILITIES,
    loading: Boolean(clientId) && query.isLoading,
    error: query.error as Error | null,
    reload,
  };
}

/** Devuelve una función que invalida las capacidades del cliente (p. ej. tras conectar Meta). */
export function useInvalidateClientCapabilities() {
  const queryClient = useQueryClient();
  const userKey = useCapabilitiesUserKey();
  return useCallback(
    (clientId: string) =>
      queryClient.invalidateQueries({ queryKey: clientCapabilitiesKey(userKey, clientId) }),
    [queryClient, userKey],
  );
}
