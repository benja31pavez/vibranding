import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  RUNS_WINDOW_DAYS,
  buildAutomationsReport,
  groupJobs,
  type AutomationsReport,
  type GroupCounts,
  type GroupId,
  type JobSnapshot,
} from "@/lib/automations/status";

export type AutomationsStatusResult =
  | ({ available: true; checkedAt: string } & AutomationsReport)
  | { available: false; checkedAt: string; message: string };

const DAY_MS = 86_400_000;

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Nombres de jobs y su horario real (cron.job), vía job_health(). */
async function loadJobList(admin: Admin): Promise<Array<Omit<JobSnapshot, "latest">>> {
  const { data, error } = await admin.rpc("job_health");
  if (!error && data) {
    return data.map((j) => ({
      name: j.job_name,
      active: j.active ?? null,
      schedule: j.schedule ?? null,
    }));
  }
  // job_health() no disponible: degradamos a los nombres vistos en job_runs (sin horario).
  console.error("[automations] job_health falló:", error?.message);
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data: runs, error: runsError } = await admin
    .from("job_runs")
    .select("job_name")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(5000);
  if (runsError) throw runsError;
  const names = Array.from(new Set((runs ?? []).map((r) => r.job_name)));
  return names.map((name) => ({ name, active: null, schedule: null }));
}

async function loadLatest(admin: Admin, name: string): Promise<JobSnapshot["latest"]> {
  const { data, error } = await admin
    .from("job_runs")
    .select("status,started_at,error")
    .eq("job_name", name)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { status: data.status, startedAt: data.started_at, error: data.error } : null;
}

async function loadGroupCounts(admin: Admin, names: string[], since: string): Promise<GroupCounts> {
  if (names.length === 0) return { total7d: 0, failed7d: 0, lastError: null };
  const base = () =>
    admin
      .from("job_runs")
      .select("id", { count: "exact", head: true })
      .in("job_name", names)
      .gte("started_at", since);
  const [total, failed, lastFailed] = await Promise.all([
    base(),
    base().eq("status", "failed"),
    admin
      .from("job_runs")
      .select("error,started_at")
      .in("job_name", names)
      .eq("status", "failed")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const r of [total, failed, lastFailed]) if (r.error) throw r.error;
  return {
    total7d: total.count ?? 0,
    failed7d: failed.count ?? 0,
    lastError: lastFailed.data
      ? { error: lastFailed.data.error, startedAt: lastFailed.data.started_at }
      : null,
  };
}

/**
 * Estado de las automatizaciones para administradores de la plataforma.
 * job_runs y job_health() son solo service_role (RLS sin políticas), así que
 * se leen aquí tras assertPlatformAdmin. Nunca se devuelven URLs, cuerpos de
 * respuesta ni errores crudos: solo el texto saneado de status.ts.
 */
export const getAutomationsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationsStatusResult> => {
    const { assertPlatformAdmin } = await import("@/lib/auth/platformAdmin.server");
    await assertPlatformAdmin(context.userId);

    const checkedAt = new Date().toISOString();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const now = new Date();
      const since = new Date(now.getTime() - RUNS_WINDOW_DAYS * DAY_MS).toISOString();

      const list = await loadJobList(supabaseAdmin);
      const jobs: JobSnapshot[] = await Promise.all(
        list.map(async (j) => ({ ...j, latest: await loadLatest(supabaseAdmin, j.name) })),
      );

      const groups = groupJobs(jobs);
      const counts = await Promise.all(
        groups.map(
          async ({ def, jobs: gj }) =>
            [
              def.id,
              await loadGroupCounts(
                supabaseAdmin,
                gj.map((j) => j.name),
                since,
              ),
            ] as const,
        ),
      );
      const countsByGroup = Object.fromEntries(counts) as Partial<Record<GroupId, GroupCounts>>;

      return { available: true, checkedAt, ...buildAutomationsReport(jobs, countsByGroup, now) };
    } catch (e) {
      console.error("[automations] no se pudo leer job_runs:", e instanceof Error ? e.message : e);
      return {
        available: false,
        checkedAt,
        message:
          "No pudimos leer el registro de ejecuciones. Reintenta en unos minutos o revisa la página de Salud.",
      };
    }
  });
