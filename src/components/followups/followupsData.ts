import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { addDaysYmd, chileToday } from "@/lib/dates/chile";
import {
  THRESHOLDS,
  closedPeriod,
  computeFollowups,
  type ProspectInput,
} from "@/lib/followups/rules";
import type { Followup } from "@/lib/followups/types";
import { BAJA_LOCKED, prospectsKey, writeError } from "@/components/prospects/prospectsData";

/**
 * Datos de "Seguimientos sugeridos". Una sola query (compartida por "Hoy" y las
 * fichas) lee lo mínimo de cada tabla visible por RLS y aplica las reglas puras
 * de src/lib/followups/rules.ts. No escribe nada salvo "Marcar como hecho" en prospectos.
 */

const REFRESH_MS = 10 * 60 * 1000;

export const followupsKey = (userId: string) => ["followups", userId] as const;

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function loadSources() {
  const today = chileToday();
  const dueLimit = addDaysYmd(today, THRESHOLDS.paymentDueSoonDays);
  const [proposals, prospects, payments, clients, billing, intakes, reports] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("proposals")
        .select(
          "id,status,sent_at,viewed_at,expires_at,token,title,amount_clp,plan_key,client_id,prospect_id",
        )
        .in("status", ["enviada", "vista"])
        .order("id")
        .range(from, to),
    ),
    // "*": no_contactar_hasta y client_id son de la v3; si aún no existen, la lectura no se rompe.
    fetchAllRows((from, to) => supabase.from("prospects").select("*").order("id").range(from, to)),
    fetchAllRows((from, to) =>
      supabase
        .from("payments")
        .select("id,client_id,amount,currency,due_date,status,payment_url,description")
        .or(`status.eq.overdue,and(status.eq.pending,due_date.lte.${dueLimit})`)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("clients")
        .select("id,name,status,created_at,started_at")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("client_billing")
        .select("client_id,plan_key,onboarding_token,onboarding_token_expires_at")
        .not("onboarding_token", "is", null)
        .order("client_id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("client_intake")
        .select("client_id,contacto_telefono")
        .order("client_id")
        .range(from, to),
    ),
    supabase
      .from("monthly_reports")
      .select("id,client_id,period,token,sent_at")
      .eq("period", closedPeriod(today))
      .is("sent_at", null)
      .then((r) => {
        fail(r.error);
        return r.data ?? [];
      }),
  ]);
  return {
    proposals: proposals.map((p) => ({ ...p, amount_clp: Number(p.amount_clp) })),
    prospects: prospects as unknown as ProspectInput[],
    payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    clients,
    billing,
    intakes,
    reports,
  };
}

export function useFollowups() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: followupsKey(userId),
    enabled: Boolean(userId),
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<Followup[]> => computeFollowups(await loadSources(), new Date()),
  });
}

/**
 * Registra el contacto con un prospecto: prospects.ultimo_contacto = ahora.
 * El UPDATE lleva `estado <> 'baja'`; 0 filas = baja o sin permisos (RLS).
 */
export function useRecordProspectContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useMutation({
    mutationFn: async (prospectId: string) => {
      const { data, error } = await supabase
        .from("prospects")
        .update({ ultimo_contacto: new Date().toISOString() })
        .eq("id", prospectId)
        .neq("estado", "baja")
        .select("id");
      if (error) throw new Error(writeError(error));
      if (!data || data.length === 0) throw new Error(BAJA_LOCKED);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: followupsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: prospectsKey(userId || "anon") });
    },
  });
}
