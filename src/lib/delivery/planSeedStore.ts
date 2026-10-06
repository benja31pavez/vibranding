/**
 * Lecturas y escrituras de la siembra de plantillas del plan, compartidas por
 * la app (sesión del usuario, RLS) y el cron del ciclo mensual (service role).
 * Recibe el cliente de Supabase como parámetro.
 *
 * Tolera migraciones sin aplicar:
 * - 20261012001800_plan_plantillas.sql (template_key, plan_template_seeds):
 *   sin registro se usa la regla de respaldo de `planSeed`.
 * - 20261012001300_etapas_estandar.sql (stage_key): se inserta sin etapa.
 * - 20261012002000_plan_ciclo_mensual.sql (claves `ciclo:` en el registro):
 *   las tareas del ciclo se crean igual, pero su clave no queda registrada
 *   (si alguien borra una, vuelve a aparecer hasta aplicar la migración).
 */
import { isLegacyLedgerKey, type SeedPlan } from "./planTemplateSeed";
import { TEAM } from "./team";

/** PostgREST / Postgres: columna o tabla que aún no existe. */
const MISSING_CODES = new Set(["PGRST204", "PGRST205", "42703", "42P01"]);
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";
const ROW_LIMIT = 2000;
/** Solo las tareas con marcador de plantilla (de inicio o del ciclo). */
const TEMPLATE_LIKE = "%[plantilla:%";

export type DbError = { code?: string; message: string };
export type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: DbError | null };

interface Query extends PromiseLike<Result> {
  eq: (k: string, v: string) => Query;
  like: (k: string, pattern: string) => Query;
  limit: (n: number) => Query;
}

/** Lo mínimo que se usa del cliente de Supabase (tablas y columnas nuevas, sin tipos). */
export interface SeedDb {
  from: (t: string) => {
    select: (c: string) => Query;
    insert: (rows: Row[]) => { select: (c: string) => PromiseLike<Result> };
    update: (values: Row) => {
      eq: (k: string, v: string) => PromiseLike<{ error: DbError | null }>;
    };
    upsert: (
      rows: Row[],
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ) => PromiseLike<{ error: DbError | null }>;
  };
}

export const isMissing = (e: DbError | null) => Boolean(e && MISSING_CODES.has(e.code ?? ""));

export type FailFn = (error: DbError) => never;

/** Tareas con marcador de plantilla del cliente (id, estado y descripción). */
export async function loadTemplateTasks(
  db: SeedDb,
  clientId: string,
  fail: FailFn,
): Promise<{ id: string; status: string; description: string | null }[]> {
  const { data, error } = await db
    .from("client_tasks")
    .select("id,status,description")
    .eq("client_id", clientId)
    .like("description", TEMPLATE_LIKE)
    .limit(ROW_LIMIT);
  if (error) fail(error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    status: String(r.status ?? ""),
    description: (r.description as string | null) ?? null,
  }));
}

/** Registro de plantillas sembradas; null si la tabla aún no existe. */
export async function loadLedger(
  db: SeedDb,
  clientId: string,
  fail: FailFn,
): Promise<Set<string> | null> {
  const { data, error } = await db
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
 * otra pestaña (o el cron) ya creó alguna (índice único), inserta una por una
 * y omite esas.
 */
export async function insertTolerant(
  db: SeedDb,
  table: string,
  rows: readonly Row[],
  optionalColumn: string,
  fail: FailFn,
): Promise<number> {
  if (rows.length === 0) return 0;
  const strip = (r: Row) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => k !== optionalColumn));
  let payload = [...rows];
  let res = await db.from(table).insert(payload).select("id");
  if (isMissing(res.error)) {
    payload = rows.map(strip);
    res = await db.from(table).insert(payload).select("id");
  }
  if (!res.error) return res.data?.length ?? 0;
  if (res.error.code !== UNIQUE_VIOLATION) fail(res.error);
  let created = 0;
  for (const row of payload) {
    const one = await db.from(table).insert([row]).select("id");
    if (one.error && one.error.code !== UNIQUE_VIOLATION) fail(one.error);
    created += one.data?.length ?? 0;
  }
  return created;
}

async function upsertLedger(db: SeedDb, clientId: string, keys: readonly string[]) {
  if (keys.length === 0) return null;
  const { error } = await db.from("plan_template_seeds").upsert(
    keys.map((item_key) => ({ client_id: clientId, item_key })),
    { onConflict: "client_id,item_key", ignoreDuplicates: true },
  );
  return error;
}

/**
 * Registra las claves. Las del ciclo (`ciclo:`) necesitan la migración del
 * ciclo mensual: si el CHECK aún no las acepta, se omiten con un aviso.
 */
export async function saveLedger(
  db: SeedDb,
  clientId: string,
  keys: readonly string[],
  fail: FailFn,
): Promise<void> {
  const legacyError = await upsertLedger(db, clientId, keys.filter(isLegacyLedgerKey));
  if (legacyError) fail(legacyError);
  const cycleError = await upsertLedger(
    db,
    clientId,
    keys.filter((k) => !isLegacyLedgerKey(k)),
  );
  if (cycleError?.code === CHECK_VIOLATION) {
    console.warn("[plan] registro del ciclo omitido: falta la migración del ciclo mensual");
    return;
  }
  if (cycleError) fail(cycleError);
}

export interface SeedResult {
  tasks: number;
  objectives: number;
}

/** Inserta lo que falta (tareas, objetivos) y registra las claves. */
export async function applySeed(
  db: SeedDb,
  clientId: string,
  plan: SeedPlan,
  hasLedger: boolean,
  fail: FailFn,
): Promise<SeedResult> {
  const tasks = await insertTolerant(
    db,
    "client_tasks",
    plan.tasks.map((t) => ({
      client_id: clientId,
      title: t.title,
      description: t.description,
      status: "pending",
      assignee: TEAM[t.owner].name,
      due_date: t.dueDate,
      stage_key: t.stage,
    })),
    "stage_key",
    fail,
  );
  const objectives = await insertTolerant(
    db,
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
    fail,
  );
  if (hasLedger) await saveLedger(db, clientId, plan.ledgerAdd, fail);
  // Tareas viejas que ahora cubre el ciclo: solo se cambia el marcador (no se borra nada).
  for (const old of plan.retire) {
    const { error } = await db
      .from("client_tasks")
      .update({ description: old.description })
      .eq("id", old.id);
    if (error) fail(error);
  }
  return { tasks, objectives };
}
