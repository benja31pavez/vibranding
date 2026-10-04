/**
 * Limpieza diaria de archivos huérfanos del onboarding.
 *
 * cleanup_onboarding_orphans() (solo service_role) borra las reservas no
 * usadas de más de 48 h y devuelve los paths a borrar de Storage: los de esas
 * reservas y los objetos del bucket sin reserva de más de 48 h. Aquí se
 * borran con la API de Storage en lotes.
 *
 * Si un lote falla, esos objetos ya no tienen reserva: la próxima corrida los
 * vuelve a devolver como 'sin_reserva' y se reintentan solos.
 */
const BUCKET = "onboarding";
/** Paths por llamada a storage.remove (acota tamaño de request y subrequests del Worker). */
const REMOVE_BATCH = 100;
/** Tope de lotes por corrida; lo que quede se borra en la siguiente. */
const MAX_BATCHES = 20;

export interface CleanupSummary {
  found: number;
  removed: number;
  failed: number;
  reasons: Record<string, number>;
  truncated: boolean;
}

export async function cleanupOnboardingOrphans(): Promise<CleanupSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("cleanup_onboarding_orphans");
  if (error) {
    console.error("[onboarding cleanup] cleanup_onboarding_orphans falló", error.code, error.message);
    throw new Error("cleanup_onboarding_orphans falló");
  }

  const rows = (Array.isArray(data) ? data : []) as Array<{ path?: unknown; reason?: unknown }>;
  const paths = [...new Set(rows.flatMap((r) => (typeof r.path === "string" && r.path ? [r.path] : [])))];
  const reasons = rows.reduce<Record<string, number>>((acc, r) => {
    const key = typeof r.reason === "string" ? r.reason : "desconocido";
    return { ...acc, [key]: (acc[key] ?? 0) + 1 };
  }, {});

  const batches = Array.from({ length: Math.ceil(paths.length / REMOVE_BATCH) }, (_, i) =>
    paths.slice(i * REMOVE_BATCH, (i + 1) * REMOVE_BATCH),
  ).slice(0, MAX_BATCHES);

  let removed = 0;
  let failed = 0;
  for (const batch of batches) {
    const { data: gone, error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove(batch);
    if (rmErr) {
      console.error("[onboarding cleanup] remove falló", rmErr.message, { size: batch.length });
      failed += batch.length;
      continue;
    }
    removed += gone?.length ?? 0;
  }

  const attempted = batches.reduce((n, b) => n + b.length, 0);
  return { found: paths.length, removed, failed, reasons, truncated: attempted < paths.length };
}
