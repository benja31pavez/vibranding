/**
 * Cron del ciclo mensual del plan: crea las tareas del ciclo (ver
 * `./planCycle`) para los clientes activos con plan mensual (Contenido,
 * Crecimiento, Mantención), por lotes en orden estable por client_id.
 * Solo servidor (service role). Idempotente: lo ya creado o borrado no se repite.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { splitBatch, withDeadline } from "@/lib/cron/batch";
import { chileDate } from "@/lib/dates/chile";
import { CYCLE_PLANS, cycleDescription, cycleMonths, cycleSeed, isCyclePlan } from "./planCycle";
import {
  applySeed,
  loadLedger,
  loadTemplateTasks,
  type DbError,
  type SeedDb,
} from "./planSeedStore";
import { presentCycleKeys, type SeedTask } from "./planTemplateSeed";

/** Cada cliente son ~4 consultas: 10 por lote caben en los 15 s del cron. */
export const PLAN_CYCLE_MAX_BATCH_LIMIT = 10;
const ACTIVE_STATUS = "activo";
export const PLAN_CYCLE_PENDING_ERROR = "pendiente: no terminó antes del límite de tiempo del cron";

const db = supabaseAdmin as unknown as SeedDb;

function fail(error: DbError): never {
  throw new Error(error.message);
}

interface ClientRow {
  client_id: string;
  plan_key: string;
  clients: { status: string; started_at: string | null; created_at: string } | null;
}

export type CycleOutcome =
  | { clientId: string; created: number; error?: undefined }
  | { clientId: string; error: string };

export interface CycleBatchSummary {
  offset: number;
  months: readonly string[];
  clients: number;
  created_tasks: number;
  failed: number;
  next_offset: number | null;
  results: CycleOutcome[];
}

function clientStart(row: ClientRow): string | null {
  const started = row.clients?.started_at;
  if (started) return started.slice(0, 10);
  const created = row.clients?.created_at ? new Date(row.clients.created_at) : null;
  return created && !Number.isNaN(created.getTime()) ? chileDate(created) : null;
}

async function seedClient(row: ClientRow, months: readonly string[]): Promise<CycleOutcome> {
  try {
    const [tasks, ledger] = await Promise.all([
      loadTemplateTasks(db, row.client_id, fail),
      loadLedger(db, row.client_id, fail),
    ]);
    const plan = cycleSeed({
      planKey: isCyclePlan(row.plan_key) ? row.plan_key : null,
      months,
      present: presentCycleKeys(tasks),
      ledger: ledger ?? new Set(),
      clientStart: clientStart(row),
    });
    const seedTasks = plan.tasks.map(
      (t): SeedTask => ({
        itemKey: t.itemKey,
        stage: t.stage,
        key: t.key,
        title: t.title,
        owner: t.owner,
        dueDate: t.dueDate,
        description: cycleDescription(t.stage, t.key, t.month),
      }),
    );
    const result = await applySeed(
      db,
      row.client_id,
      { tasks: seedTasks, objectives: [], ledgerAdd: plan.ledgerAdd },
      ledger !== null,
      fail,
    );
    return { clientId: row.client_id, created: result.tasks };
  } catch (e) {
    const message = (e as Error)?.message ?? "Error inesperado";
    console.error("[plan ciclo] cliente falló", { clientId: row.client_id, message });
    return { clientId: row.client_id, error: message };
  }
}

/**
 * Un lote de clientes. `months` por defecto: el mes actual y, desde el día 25
 * (hora de Chile), también el siguiente.
 */
export async function runPlanCycleBatch(opts: {
  offset: number;
  limit: number;
  deadlineMs: number;
  months?: readonly string[];
  now?: Date;
}): Promise<CycleBatchSummary> {
  const limit = Math.min(PLAN_CYCLE_MAX_BATCH_LIMIT, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);
  const months = opts.months ?? cycleMonths(chileDate(opts.now ?? new Date()));
  const { data, error } = await supabaseAdmin
    .from("client_billing")
    .select("client_id,plan_key,clients!inner(status,started_at,created_at)")
    .in("plan_key", [...CYCLE_PLANS])
    .eq("clients.status", ACTIVE_STATUS)
    .order("client_id", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error(`No se pudieron listar los clientes: ${error.message}`);

  const { batch, nextOffset } = splitBatch((data ?? []) as unknown as ClientRow[], offset, limit);
  const results = await Promise.all(
    batch.map((row) =>
      withDeadline<CycleOutcome>(seedClient(row, months), opts.deadlineMs, () => ({
        clientId: row.client_id,
        error: PLAN_CYCLE_PENDING_ERROR,
      })),
    ),
  );
  return {
    offset,
    months,
    clients: batch.length,
    created_tasks: results.reduce((n, r) => n + ("created" in r ? r.created : 0), 0),
    failed: results.filter((r) => r.error).length,
    next_offset: nextOffset,
    results,
  };
}
