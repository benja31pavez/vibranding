import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRows } from "@/lib/db/fetchAllRows";

/**
 * MRR único de la agencia (lo usan "Hoy" y "Cobros", así siempre coinciden).
 *
 * MRR (CLP) = Σ subscriptions.amount_clp (status 'activa', cliente 'activo')
 *           + Σ client_billing.mrr de clientes 'activo' SIN suscripción activa.
 * Así un cliente nunca se cuenta dos veces. El intervalo de las suscripciones
 * es siempre mensual (CHECK en la tabla).
 */
export interface MrrSummary {
  total: number;
  /** Suma de suscripciones activas de clientes activos. */
  fromSubscriptions: number;
  subscriptionClients: number;
  /** client_billing.mrr de clientes activos sin suscripción activa. */
  fromBilling: number;
  billingClients: number;
}

interface MrrInputs {
  activeClientIds: readonly string[];
  subscriptions: ReadonlyArray<{ client_id: string; amount_clp: number | string }>;
  billing: ReadonlyArray<{ client_id: string; mrr: number | string | null }>;
}

/** Cálculo puro (sin red), separado para poder probarlo. */
export function computeMrr({ activeClientIds, subscriptions, billing }: MrrInputs): MrrSummary {
  const activeIds = new Set(activeClientIds);
  const activeSubs = subscriptions.filter((s) => activeIds.has(s.client_id));
  const subscribed = new Set(activeSubs.map((s) => s.client_id));
  const billed = billing.filter((b) => activeIds.has(b.client_id) && !subscribed.has(b.client_id));
  const fromSubscriptions = activeSubs.reduce((acc, s) => acc + Number(s.amount_clp), 0);
  const fromBilling = billed.reduce((acc, b) => acc + Number(b.mrr ?? 0), 0);
  return {
    total: fromSubscriptions + fromBilling,
    fromSubscriptions,
    subscriptionClients: subscribed.size,
    fromBilling,
    billingClients: billed.length,
  };
}

export async function loadMrr(): Promise<MrrSummary> {
  const [active, subscriptions, billing] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from("clients").select("id").eq("status", "activo").order("id").range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("subscriptions")
        .select("id,client_id,amount_clp")
        .eq("status", "activa")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase.from("client_billing").select("client_id,mrr").order("client_id").range(from, to),
    ),
  ]);
  return computeMrr({ activeClientIds: active.map((c) => c.id), subscriptions, billing });
}

export const MRR_KEY_PREFIX = ["mrr"] as const;
export const mrrKey = (userId: string) => [...MRR_KEY_PREFIX, userId] as const;

/**
 * Recalcula el MRR en "Hoy" y /billing. Llamar tras cambiar client_billing,
 * suscripciones o el estado de un cliente (activo/inactivo).
 */
export function invalidateMrr(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: MRR_KEY_PREFIX });
}

export function useMrr() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: mrrKey(userId),
    enabled: Boolean(userId),
    queryFn: loadMrr,
  });
}
