/**
 * Plantillas del plan en la base de datos: crea las tareas y objetivos
 * estándar que falten (`planSeed`, lógica pura) y lee las señales de la
 * plataforma que marcan una tarea como "Detectado ✓ — revisar".
 *
 * Tolera que la migración 20261012001800_plan_plantillas.sql (template_key,
 * plan_template_seeds) y la de etapas (stage_key) no estén aplicadas.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adsBillingRows, parsePlatforms } from "@/lib/ads-billing/combined";
import { resolvePlan, toMonthPlanKey } from "@/lib/delivery/planStages";
import { templateDescription, type PlanSignal } from "@/lib/delivery/planChecklists";
import { detectSignals } from "@/lib/delivery/planSignals";
import { planSeed, type SeedObjectiveLike } from "@/lib/delivery/planTemplateSeed";
import { TEAM } from "@/lib/delivery/team";
import { loadAdsBillingSources } from "@/components/clients/ficha/adsBillingSources";
import { writeErrorMessage } from "@/components/clients/ficha/fichaQueries";
import { planKeys } from "./planQueries";

/** PostgREST / Postgres: columna o tabla que aún no existe. */
const MISSING_CODES = new Set(["PGRST204", "PGRST205", "42703", "42P01"]);
const UNIQUE_VIOLATION = "23505";
const ROW_LIMIT = 500;

type DbError = { code?: string; message: string };
type Row = Record<string, unknown>;

// Tabla nueva (plan_template_seeds) y columnas nuevas aún sin tipos generados.
const untyped = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        limit: (n: number) => Promise<{ data: Row[] | null; error: DbError | null }>;
      };
    };
    insert: (rows: Row[]) => {
      select: (c: string) => Promise<{ data: Row[] | null; error: DbError | null }>;
    };
    upsert: (
      rows: Row[],
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error: DbError | null }>;
  };
};

const isMissing = (e: DbError | null) => Boolean(e && MISSING_CODES.has(e.code ?? ""));

function fail(error: DbError): never {
  throw new Error(writeErrorMessage(error));
}

async function selectAll(table: string, columns: string, clientId: string): Promise<Row[]> {
  const { data, error } = await untyped
    .from(table)
    .select(columns)
    .eq("client_id", clientId)
    .limit(ROW_LIMIT);
  if (error) fail(error);
  return data ?? [];
}

/** Registro de plantillas sembradas; null si la tabla aún no existe. */
async function loadLedger(clientId: string): Promise<Set<string> | null> {
  const { data, error } = await untyped
    .from("plan_template_seeds")
    .select("item_key")
    .eq("client_id", clientId)
    .limit(ROW_LIMIT);
  if (isMissing(error)) return null;
  if (error) fail(error);
  return new Set((data ?? []).map((r) => String(r.item_key)));
}

/**
 * Inserta filas; si una columna opcional no existe, reintenta sin ella. Si
 * otra pestaña ya creó alguna (índice único), inserta una por una y omite esas.
 */
async function insertTolerant(
  table: string,
  rows: readonly Row[],
  optionalColumn: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  const strip = (r: Row) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => k !== optionalColumn));
  let payload = [...rows];
  let res = await untyped.from(table).insert(payload).select("id");
  if (isMissing(res.error)) {
    payload = rows.map(strip);
    res = await untyped.from(table).insert(payload).select("id");
  }
  if (!res.error) return res.data?.length ?? 0;
  if (res.error.code !== UNIQUE_VIOLATION) fail(res.error);
  let created = 0;
  for (const row of payload) {
    const one = await untyped.from(table).insert([row]).select("id");
    if (one.error && one.error.code !== UNIQUE_VIOLATION) fail(one.error);
    created += one.data?.length ?? 0;
  }
  return created;
}

export interface SeedResult {
  tasks: number;
  objectives: number;
}

/** Datos del cliente que adaptan la plantilla: adicionales contratados y plataformas de pauta. */
async function loadContext(clientId: string, planKey: string | null) {
  const [contracts, intake] = await Promise.all([
    supabase
      .from("client_contracts")
      .select("services_snapshot")
      .eq("client_id", clientId)
      .eq("status", "signed")
      .limit(50),
    supabase.from("client_intake").select("*").eq("client_id", clientId).maybeSingle(),
  ]);
  if (contracts.error) fail(contracts.error);
  if (intake.error) fail(intake.error);
  const addons = (contracts.data ?? []).flatMap((row) =>
    Array.isArray(row.services_snapshot)
      ? row.services_snapshot.flatMap((line) => {
          const key = (line as { service_key?: unknown } | null)?.service_key;
          return typeof key === "string" ? [key] : [];
        })
      : [],
  );
  const plan = resolvePlan(planKey, addons);
  return {
    planKey: toMonthPlanKey(planKey),
    stages: plan.stages,
    adsPlatforms: parsePlatforms((intake.data as Row | null)?.ads_platforms),
  };
}

async function seedOnce(clientId: string, planKey: string | null): Promise<SeedResult> {
  const ctx = await loadContext(clientId, planKey);
  if (!ctx.planKey) return { tasks: 0, objectives: 0 };
  const [tasks, objectives, ledger] = await Promise.all([
    selectAll("client_tasks", "description", clientId),
    selectAll("objectives", "*", clientId),
    loadLedger(clientId),
  ]);
  const plan = planSeed({
    ctx,
    tasks: tasks.map((t) => ({ description: (t.description as string | null) ?? null })),
    objectives: objectives as unknown as SeedObjectiveLike[],
    ledger: ledger ?? new Set(),
  });

  const createdTasks = await insertTolerant(
    "client_tasks",
    plan.tasks.map((t) => ({
      client_id: clientId,
      title: t.title,
      description: templateDescription(t.stage, t.key),
      status: "pending",
      assignee: TEAM[t.owner].name,
      stage_key: t.stage,
    })),
    "stage_key",
  );
  const createdObjectives = await insertTolerant(
    "objectives",
    plan.objectives.map((o) => ({
      client_id: clientId,
      title: o.title,
      category: o.category,
      unit: o.metric,
      target_value: o.target,
      template_key: o.itemKey,
    })),
    "template_key",
  );
  if (ledger && plan.ledgerAdd.length > 0) {
    const { error } = await untyped.from("plan_template_seeds").upsert(
      plan.ledgerAdd.map((item_key) => ({ client_id: clientId, item_key })),
      { onConflict: "client_id,item_key", ignoreDuplicates: true },
    );
    if (error) fail(error);
  }
  return { tasks: createdTasks, objectives: createdObjectives };
}

/** Una siembra a la vez por cliente (dos pestañas o dos efectos no duplican). */
const inFlight = new Map<string, Promise<SeedResult>>();

/**
 * Crea las tareas y objetivos estándar que falten para el plan del cliente.
 * Nunca borra ni edita nada. Sin plan conocido no hace nada.
 */
export function seedPlanTemplates(clientId: string, planKey: string | null): Promise<SeedResult> {
  const id = `${clientId}:${planKey ?? ""}`;
  const running = inFlight.get(id);
  if (running) return running;
  const job = seedOnce(clientId, planKey).finally(() => inFlight.delete(id));
  inFlight.set(id, job);
  return job;
}

// ─── Señales ────────────────────────────────────────────────────────────────

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

async function optionalSelect(table: string, columns: string, clientId: string): Promise<Row[]> {
  const { data, error } = await untyped
    .from(table)
    .select(columns)
    .eq("client_id", clientId)
    .limit(ROW_LIMIT);
  if (error) {
    console.warn(`[plan] señales: ${table} no disponible`, error.message);
    return [];
  }
  return data ?? [];
}

async function loadSignals(clientId: string, today: string): Promise<ReadonlySet<PlanSignal>> {
  const [ads, landings, multilinks, reports] = await Promise.all([
    loadAdsBillingSources(clientId),
    optionalSelect("landing_pages", "published,slug,whatsapp_enabled,contact_enabled", clientId),
    optionalSelect("multilinks", "published", clientId),
    optionalSelect("monthly_reports", "period,sent_at", clientId),
  ]);
  const intake = ads.intake;
  return detectSignals({
    intake: intake
      ? {
          publicoObjetivo:
            typeof intake.publico_objetivo === "string" ? intake.publico_objetivo : null,
          colores: strings(intake.colores),
          archivos: strings(intake.archivos),
        }
      : null,
    metaLinked: Boolean(ads.metaAdAccountId),
    googleLinked: Boolean(ads.googleCustomerId),
    adsBilling: adsBillingRows(ads).map((r) => r.state),
    landings: landings.map((l) => ({
      published: l.published === true,
      slug: typeof l.slug === "string" ? l.slug : null,
      whatsappEnabled: l.whatsapp_enabled === true,
      contactEnabled: l.contact_enabled === true,
    })),
    multilinks: multilinks.map((m) => ({ published: m.published === true })),
    reports: reports.map((r) => ({
      period: String(r.period ?? ""),
      sentAt: typeof r.sent_at === "string" ? r.sent_at : null,
    })),
    today,
  });
}

/** Señales de la plataforma del cliente (para "Detectado ✓ — revisar"). */
export function usePlanSignals(userKey: string, clientId: string, today: string) {
  return useQuery({
    queryKey: [...planKeys.all(userKey, clientId), "signals", today] as const,
    queryFn: () => loadSignals(clientId, today),
    staleTime: 5 * 60_000,
  });
}
