import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type ReviewAlert = {
  id: string;
  deliverable_id: string;
  client_id: string;
  kind: "comment" | "approval" | "change_request";
  body: string;
  author_name: string | null;
  created_at: string;
  deliverable_title: string;
};

const ALERTS_LIMIT = 20;

async function fetchAlerts(clientId?: string): Promise<ReviewAlert[]> {
  let q = supabase
    .from("deliverable_comments")
    .select("id,deliverable_id,client_id,kind,body,author_name,created_at,deliverables(title)")
    .neq("author_role", "agency")
    .eq("read_by_agency", false)
    .order("created_at", { ascending: false })
    .limit(ALERTS_LIMIT);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    deliverable_title: r.deliverables?.title ?? "Entregable",
  })) as ReviewAlert[];
}

/** Unread client/guest review activity, optionally scoped to one client. */
export function useReviewAlerts(clientId?: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const query = useQuery({
    queryKey: ["review-alerts", userId, clientId ?? "all"],
    enabled: Boolean(userId),
    queryFn: () => fetchAlerts(clientId),
  });
  const alerts = query.data ?? [];
  return {
    alerts,
    count: alerts.length,
    loading: query.isPending && !query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    reload: async () => {
      await query.refetch();
    },
    retrying: query.isFetching,
  };
}
