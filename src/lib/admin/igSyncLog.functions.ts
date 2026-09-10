import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IgSyncRun = {
  id: string;
  client_id: string;
  client_name: string | null;
  status: "ok" | "error";
  requested_label: string | null;
  persisted_label: string | null;
  media_count: number | null;
  swapped: boolean;
  is_baseline: boolean;
  note: string | null;
  error: string | null;
  created_at: string;
};

/** Audit trail of Instagram sync runs, scoped by RLS to the user's clients. */
export const listIgSyncRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IgSyncRun[]> => {
    const { data, error } = await (context.supabase.from("ig_sync_runs" as any) as any)
      .select(
        "id,client_id,status,requested_label,persisted_label,media_count,swapped,is_baseline,note,error,created_at,clients(name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: String(r.id),
      client_id: String(r.client_id),
      client_name: r.clients?.name ?? null,
      status: r.status,
      requested_label: r.requested_label ?? null,
      persisted_label: r.persisted_label ?? null,
      media_count: r.media_count ?? null,
      swapped: Boolean(r.swapped),
      is_baseline: Boolean(r.is_baseline),
      note: r.note ?? null,
      error: r.error ?? null,
      created_at: r.created_at,
    }));
  });
