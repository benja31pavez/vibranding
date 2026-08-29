import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

async function fetchAlerts(clientId?: string) {
  let q = supabase
    .from("deliverable_comments")
    .select("id,deliverable_id,client_id,kind,body,author_name,created_at,deliverables(title)")
    .neq("author_role", "agency")
    .eq("read_by_agency", false)
    .order("created_at", { ascending: false })
    .limit(20);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    deliverable_title: r.deliverables?.title ?? "Entregable",
  })) as ReviewAlert[];
}

/** Unread client/guest review activity, optionally scoped to one client. */
export function useReviewAlerts(clientId?: string) {
  const [alerts, setAlerts] = useState<ReviewAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setAlerts(await fetchAlerts(clientId));
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    fetchAlerts(clientId).then((rows) => {
      if (alive) {
        setAlerts(rows);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [clientId]);

  return { alerts, count: alerts.length, loading, reload };
}
