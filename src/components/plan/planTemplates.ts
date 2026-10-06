/**
 * Plantillas del plan en la base de datos: crea las tareas de inicio, las del
 * ciclo mensual y los objetivos estándar que falten (`planSeed`, lógica pura;
 * escrituras en `planSeedStore`) y lee las señales de la plataforma que marcan
 * una tarea como "Detectado ✓ — revisar".
 *
 * Tolera que las migraciones de plantillas, del ciclo mensual y de etapas no
 * estén aplicadas (ver `planSeedStore`).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adsBillingRows, parsePlatforms } from "@/lib/ads-billing/combined";
import { chileDate, chileToday } from "@/lib/dates/chile";
import { resolvePlan, toMonthPlanKey } from "@/lib/delivery/planStages";
import { detectSignals, type SignalSet } from "@/lib/delivery/planSignals";
import { planSeed, type SeedObjectiveLike } from "@/lib/delivery/planTemplateSeed";
import {
  applySeed,
  loadLedger,
  loadTemplateTasks,
  type DbError,
  type Row,
  type SeedDb,
  type SeedResult,
} from "@/lib/delivery/planSeedStore";
import { loadAdsBillingSources } from "@/components/clients/ficha/adsBillingSources";
import { writeErrorMessage } from "@/components/clients/ficha/fichaQueries";
import { planKeys } from "./planQueries";

export type { SeedResult } from "@/lib/delivery/planSeedStore";

const ROW_LIMIT = 500;
/** `clients.status` de un cliente activo (solo esos tienen ciclo mensual). */
const ACTIVE_STATUS = "activo";

// Tabla nueva (plan_template_seeds) y columnas nuevas aún sin tipos generados.
const db = supabase as unknown as SeedDb;

function fail(error: DbError): never {
  throw new Error(writeErrorMessage(error));
}

/** Inicio del cliente ("AAAA-MM-DD"): `started_at` o, si no hay, la fecha de creación. */
function clientStartOf(row: Row | null): string | null {
  const started = typeof row?.started_at === "string" ? row.started_at : null;
  if (started) return started.slice(0, 10);
  const created = typeof row?.created_at === "string" ? new Date(row.created_at) : null;
  return created && !Number.isNaN(created.getTime()) ? chileDate(created) : null;
}

/** Datos del cliente que adaptan la plantilla: adicionales, plataformas de pauta, inicio y estado. */
async function loadContext(clientId: string, planKey: string | null) {
  const [contracts, intake, client] = await Promise.all([
    supabase
      .from("client_contracts")
      .select("services_snapshot")
      .eq("client_id", clientId)
      .eq("status", "signed")
      .limit(50),
    supabase.from("client_intake").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("clients")
      .select("status,started_at,created_at")
      .eq("id", clientId)
      .maybeSingle(),
  ]);
  if (contracts.error) fail(contracts.error);
  if (intake.error) fail(intake.error);
  if (client.error) fail(client.error);
  const addons = (contracts.data ?? []).flatMap((row) =>
    Array.isArray(row.services_snapshot)
      ? row.services_snapshot.flatMap((line) => {
          const key = (line as { service_key?: unknown } | null)?.service_key;
          return typeof key === "string" ? [key] : [];
        })
      : [],
  );
  const plan = resolvePlan(planKey, addons);
  const clientRow = (client.data as Row | null) ?? null;
  return {
    ctx: {
      planKey: toMonthPlanKey(planKey),
      stages: plan.stages,
      adsPlatforms: parsePlatforms((intake.data as Row | null)?.ads_platforms),
    },
    clientStart: clientStartOf(clientRow),
    active: clientRow?.status === ACTIVE_STATUS,
  };
}

async function seedOnce(clientId: string, planKey: string | null): Promise<SeedResult> {
  const { ctx, clientStart, active } = await loadContext(clientId, planKey);
  if (!ctx.planKey) return { tasks: 0, objectives: 0 };
  const [tasks, objectives, ledger] = await Promise.all([
    loadTemplateTasks(db, clientId, fail),
    selectObjectives(clientId),
    loadLedger(db, clientId, fail),
  ]);
  const plan = planSeed({
    ctx,
    tasks,
    objectives: objectives as unknown as SeedObjectiveLike[],
    ledger: ledger ?? new Set(),
    today: chileToday(),
    clientStart,
    cycleActive: active,
  });
  return applySeed(db, clientId, plan, ledger !== null, fail);
}

async function selectObjectives(clientId: string): Promise<Row[]> {
  const { data, error } = await db
    .from("objectives")
    .select("*")
    .eq("client_id", clientId)
    .limit(ROW_LIMIT);
  if (error) fail(error);
  return data ?? [];
}

/** Una siembra a la vez por cliente (dos pestañas o dos efectos no duplican). */
const inFlight = new Map<string, Promise<SeedResult>>();

/**
 * Crea las tareas de inicio, las del ciclo del mes (y del siguiente desde el
 * día 25) y los objetivos estándar que falten. Nunca borra ni edita nada. Sin
 * plan conocido no hace nada.
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
  const { data, error } = await db
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

async function loadSignals(clientId: string, today: string): Promise<SignalSet> {
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
