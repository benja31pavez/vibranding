import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JobHealthRow = {
  job_name: string;
  active: boolean | null;
  schedule: string | null;
  last_run: string | null;
  last_success: string | null;
  failed_24h: number;
  total_24h: number;
};

export type JobRunRow = {
  id: string;
  job_name: string;
  status: string;
  http_status: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

/**
 * job_runs and job_health() are service-role only, so the page reads them
 * through this authenticated server function.
 */
export const getJobHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: health, error } = await (supabaseAdmin.rpc as any)("job_health");
    if (error) throw new Error(error.message);

    const { data: recent } = await (supabaseAdmin.from("job_runs" as any) as any)
      .select("id,job_name,status,http_status,error,started_at,finished_at")
      .order("started_at", { ascending: false })
      .limit(25);

    return {
      jobs: (health ?? []) as JobHealthRow[],
      recent: (recent ?? []) as JobRunRow[],
      checkedAt: new Date().toISOString(),
    };
  });
