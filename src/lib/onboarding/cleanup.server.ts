/**
 * Limpieza diaria de archivos huérfanos del onboarding, en dos fases
 * (migración 20261012000800_onboarding_cleanup_2fases):
 *   1. list_onboarding_orphans(limit) lista reservas vencidas y objetos del
 *      bucket sin reserva ni referencia en client_intake (no borra nada).
 *   2. Se borran de Storage en lotes.
 *   3. delete_onboarding_reservations(paths) borra las reservas solo de los
 *      lotes que Storage completó sin error.
 * Si un lote falla, su reserva sigue en la tabla y la próxima corrida lo
 * reintenta: ningún archivo con datos personales queda sin rastro.
 *
 * Respaldo: si la migración aún no está aplicada (PGRST202/42883) se usa
 * cleanup_onboarding_orphans(), que borra las reservas antes que los archivos.
 */
import {
  chunk,
  countReasons,
  isMissingRpcError,
  parseOrphanRows,
  reservationPathsToDelete,
  type OrphanRow,
} from "./cleanup";

const BUCKET = "onboarding";
/** Paths por llamada a storage.remove (acota tamaño de request y subrequests del Worker). */
const REMOVE_BATCH = 100;
/** Tope de lotes por corrida; lo que quede se borra en la siguiente. */
const MAX_BATCHES = 20;
const LIST_LIMIT = REMOVE_BATCH * MAX_BATCHES;

export interface CleanupSummary {
  mode: "dos_fases" | "legacy";
  found: number;
  /** Objetos que Storage confirmó borrados en esta corrida. */
  removed: number;
  /** Paths cuyo borrado (archivo o reserva) falló; se reintentan solos. */
  failed: number;
  reservationsDeleted: number;
  reasons: Record<string, number>;
  truncated: boolean;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

interface RemoveResult {
  removed: number;
  failed: number;
  cleared: Set<string>;
}

async function removeFromStorage(db: Admin, paths: readonly string[]): Promise<RemoveResult> {
  let removed = 0;
  let failed = 0;
  const cleared = new Set<string>();
  for (const batch of chunk(paths, REMOVE_BATCH, MAX_BATCHES)) {
    const { data: gone, error } = await db.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error("[onboarding cleanup] remove falló", error.message, { size: batch.length });
      failed += batch.length;
      continue;
    }
    removed += gone?.length ?? 0;
    batch.forEach((p) => cleared.add(p));
  }
  return { removed, failed, cleared };
}

async function deleteReservations(
  db: Admin,
  paths: string[],
): Promise<{ deleted: number; failed: number }> {
  if (paths.length === 0) return { deleted: 0, failed: 0 };
  const { data, error } = await db.rpc("delete_onboarding_reservations", { _paths: paths });
  if (error) {
    console.error(
      "[onboarding cleanup] delete_onboarding_reservations falló",
      error.code,
      error.message,
      { size: paths.length },
    );
    return { deleted: 0, failed: paths.length };
  }
  return { deleted: typeof data === "number" ? data : 0, failed: 0 };
}

async function legacyCleanup(db: Admin): Promise<CleanupSummary> {
  const { data, error } = await db.rpc("cleanup_onboarding_orphans");
  if (error) {
    console.error(
      "[onboarding cleanup] cleanup_onboarding_orphans falló",
      error.code,
      error.message,
    );
    throw new Error("cleanup_onboarding_orphans falló");
  }
  const rows = parseOrphanRows(data);
  const paths = rows.map((r) => r.path);
  const { removed, failed } = await removeFromStorage(db, paths);
  return {
    mode: "legacy",
    found: paths.length,
    removed,
    failed,
    reservationsDeleted: rows.filter((r) => r.reason === "reserva_vencida").length,
    reasons: countReasons(rows),
    truncated: paths.length > LIST_LIMIT,
  };
}

export async function cleanupOnboardingOrphans(): Promise<CleanupSummary> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db.rpc("list_onboarding_orphans", { _limit: LIST_LIMIT + 1 });
  if (isMissingRpcError(error)) {
    console.warn(
      "[onboarding cleanup] list_onboarding_orphans no existe; usando cleanup_onboarding_orphans",
    );
    return legacyCleanup(db);
  }
  if (error) {
    console.error("[onboarding cleanup] list_onboarding_orphans falló", error.code, error.message);
    throw new Error("list_onboarding_orphans falló");
  }

  const all = parseOrphanRows(data);
  const rows: OrphanRow[] = all.slice(0, LIST_LIMIT);
  const storage = await removeFromStorage(
    db,
    rows.map((r) => r.path),
  );
  const reservations = await deleteReservations(
    db,
    reservationPathsToDelete(rows, storage.cleared),
  );

  return {
    mode: "dos_fases",
    found: rows.length,
    removed: storage.removed,
    failed: storage.failed + reservations.failed,
    reservationsDeleted: reservations.deleted,
    reasons: countReasons(rows),
    truncated: all.length > LIST_LIMIT,
  };
}
