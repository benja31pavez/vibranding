import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isReportData, type MonthlyReportData } from "@/lib/reports/types";

export type MonthlyReportRow = Pick<
  Tables<"monthly_reports">,
  "id" | "client_id" | "period" | "token" | "summary" | "sent_at" | "updated_at"
> & { data: MonthlyReportData | null };

const COLUMNS = "id,client_id,period,token,summary,sent_at,updated_at,data";
const MAX_MONTHS = 24;

export const reportKeys = {
  client: (userId: string, clientId: string) => ["monthly-reports", userId, clientId] as const,
  period: (userId: string, period: string) =>
    ["monthly-reports", userId, "period", period] as const,
};

function toRow(r: Tables<"monthly_reports">): MonthlyReportRow {
  return { ...r, data: isReportData(r.data) ? r.data : null };
}

export function useClientReports(userKey: string, clientId: string) {
  return useQuery({
    queryKey: reportKeys.client(userKey, clientId),
    queryFn: async (): Promise<MonthlyReportRow[]> => {
      const { data, error } = await supabase
        .from("monthly_reports")
        .select(COLUMNS)
        .eq("client_id", clientId)
        .order("period", { ascending: false })
        .limit(MAX_MONTHS);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => toRow(r as Tables<"monthly_reports">));
    },
  });
}

/** Reportes de todos los clientes visibles para un periodo. */
export function usePeriodReports(userKey: string, period: string) {
  return useQuery({
    queryKey: reportKeys.period(userKey, period),
    queryFn: async (): Promise<MonthlyReportRow[]> => {
      const { data, error } = await supabase
        .from("monthly_reports")
        .select(COLUMNS)
        .eq("period", period);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => toRow(r as Tables<"monthly_reports">));
    },
  });
}

export function publicReportUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/r/${token}`;
}
