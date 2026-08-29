import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Counts WhatsApp conversations without a marked outcome for a client.
 * `stale` = unmarked and last activity older than 24h (the real backlog).
 */
export function useUnmarkedOutcomes(clientId: string | null | undefined) {
  const [total, setTotal] = useState(0);
  const [stale, setStale] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setTotal(0);
      setStale(0);
      return;
    }
    setLoading(true);
    const [{ data: convs }, { data: outs }] = await Promise.all([
      supabase
        .from("whatsapp_conversations")
        .select("id,last_message_at")
        .eq("client_id", clientId),
      (supabase.from("conversation_outcomes" as any) as any)
        .select("conversation_id")
        .eq("client_id", clientId),
    ]);
    const marked = new Set<string>(
      ((outs ?? []) as { conversation_id: string }[]).map((o) => o.conversation_id),
    );
    const unmarked = ((convs ?? []) as { id: string; last_message_at: string | null }[]).filter(
      (c) => !marked.has(c.id),
    );
    const now = Date.now();
    setTotal(unmarked.length);
    setStale(
      unmarked.filter(
        (c) => !c.last_message_at || now - new Date(c.last_message_at).getTime() > DAY_MS,
      ).length,
    );
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { total, stale, loading, refresh };
}

export function isStale(lastMessageAt: string | null): boolean {
  if (!lastMessageAt) return true;
  return Date.now() - new Date(lastMessageAt).getTime() > DAY_MS;
}
