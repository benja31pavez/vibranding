// Server-only: refresco semanal de logos desde Instagram, por lotes (cron).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { splitBatch, withDeadline } from "@/lib/cron/batch";
import { isLogoStale } from "@/lib/clients/logo";
import { refreshLogoFromInstagram } from "@/lib/clients/logo.server";

/** Cada cliente: Graph + descarga + subida (~2-4 s); 5 en paralelo caben en 12 s. */
export const LOGO_MAX_BATCH_LIMIT = 5;
const PENDING_ERROR = "No alcanzó a terminar en este lote; se reintenta la próxima semana";

type CandidateRow = { id: string; logo_updated_at: string | null };

type LogoOutcome = {
  clientId: string;
  result: "updated" | "fresh" | "skipped" | "failed";
  reason?: string;
  error?: string;
};

export type LogoBatchSummary = {
  offset: number;
  clients: number;
  updated: number;
  fresh: number;
  skipped: number;
  failed: number;
  next_offset: number | null;
  results: LogoOutcome[];
};

async function refreshOne(row: CandidateRow, now: Date): Promise<LogoOutcome> {
  if (!isLogoStale(row.logo_updated_at, now)) return { clientId: row.id, result: "fresh" };
  try {
    const res = await refreshLogoFromInstagram(row.id, "auto");
    // Cuenta personal, sin @ o logo manual: es esperable, no una falla del cron.
    if (res.status === "skipped")
      return { clientId: row.id, result: "skipped", reason: res.reason };
    return { clientId: row.id, result: "updated" };
  } catch (e) {
    const message = (e as Error)?.message ?? "Error inesperado";
    console.error("[client-logo cron] failed", row.id, message);
    return { clientId: row.id, result: "failed", error: message };
  }
}

/**
 * Candidatos con orden estable por id (los offsets del cron no se corren
 * aunque un lote actualice filas): logos de Instagram y clientes con @ sin
 * logo todavía. Los manuales nunca entran. Los frescos (< 7 días) se saltan.
 */
export async function runLogoRefreshBatch(opts: {
  offset: number;
  limit: number;
  deadlineMs: number;
}): Promise<LogoBatchSummary> {
  const limit = Math.min(LOGO_MAX_BATCH_LIMIT, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id,logo_updated_at")
    .or("logo_source.eq.instagram,and(logo_source.is.null,instagram_handle.not.is.null)")
    .order("id", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw new Error(`No se pudieron listar los clientes: ${error.message}`);

  const { batch, nextOffset } = splitBatch((data ?? []) as CandidateRow[], offset, limit);
  const now = new Date();
  const results = await Promise.all(
    batch.map((row) =>
      withDeadline<LogoOutcome>(refreshOne(row, now), opts.deadlineMs, () => ({
        clientId: row.id,
        result: "failed",
        error: PENDING_ERROR,
      })),
    ),
  );
  const count = (r: LogoOutcome["result"]) => results.filter((x) => x.result === r).length;
  return {
    offset,
    clients: results.length,
    updated: count("updated"),
    fresh: count("fresh"),
    skipped: count("skipped"),
    failed: count("failed"),
    next_offset: nextOffset,
    results,
  };
}
