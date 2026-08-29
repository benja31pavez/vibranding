import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PostMetrics = {
  reach: number;
  engagement: number;
  saves: number;
  date: string;
};

/**
 * Latest post_insights_daily row per Instagram media for a client.
 * Rows come back newest-first, so the first one seen per post_id wins.
 */
export function usePostInsights(clientId: string | undefined) {
  const [metrics, setMetrics] = useState<Record<string, PostMetrics>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("post_insights_daily")
        .select("post_id,reach,engagement,saves,date")
        .eq("client_id", clientId)
        .order("date", { ascending: false })
        .limit(1000);
      if (cancelled) return;
      const latest: Record<string, PostMetrics> = {};
      for (const row of (data ?? []) as any[]) {
        const key = String(row.post_id);
        if (latest[key]) continue;
        latest[key] = {
          reach: Number(row.reach) || 0,
          engagement: Number(row.engagement) || 0,
          saves: Number(row.saves) || 0,
          date: String(row.date),
        };
      }
      setMetrics(latest);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { metrics, loading };
}
