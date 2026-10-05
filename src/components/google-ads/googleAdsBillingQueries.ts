import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";

export const googleAdsBillingKey = (userKey: string, clientId: string) =>
  ["google-ads-billing", userKey, clientId] as const;

/** Último estado de facturación guardado por el chequeo diario (RLS: miembros de la org). */
export function useGoogleAdsBilling(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: googleAdsBillingKey(userKey, clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_ads_billing_status")
        .select(
          "verdict,has_valid_billing,customer_status,billing_status,payments_account_name,budget_limit_clp,budget_served_clp,budget_end_at,detail,check_error,checked_at",
        )
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
