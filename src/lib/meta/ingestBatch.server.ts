// Un lote de la ingesta diaria de Meta (lo llama /api/public/meta/ingest-daily).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { META_MAX_BATCH_LIMIT, splitBatch } from "@/lib/cron/batch";
import { getMetaToken } from "@/lib/meta/tokens.server";
import { ingestAccountDay, type IngestResult } from "@/lib/meta/insights.server";

type MetaAccountRow = {
  id: string;
  client_id: string;
  ad_account_id: string | null;
  ig_account_id: string | null;
  timezone_name: string | null;
};

export type MetaAccountOutcome = IngestResult | { accountId: string; error: string };

export type MetaIngestBatchSummary = {
  offset: number;
  accounts: number;
  succeeded: number;
  failed: number;
  rowsWritten: number;
  adRows: number;
  postRows: number;
  next_offset: number | null;
  results: MetaAccountOutcome[];
};

/** Nunca lanza: cualquier fallo de la cuenta queda como { accountId, error }. */
async function ingestOne(
  account: MetaAccountRow,
  date: string | undefined,
  windowDays: number,
): Promise<MetaAccountOutcome> {
  try {
    const token = await getMetaToken(account.id);
    if (!token) return { accountId: account.id, error: "sin token en el vault" };
    return await ingestAccountDay(account, token, date, windowDays);
  } catch (e) {
    const message = (e as Error)?.message ?? "Error inesperado";
    console.error("[meta ingest] cuenta falló", { accountId: account.id, message });
    return { accountId: account.id, error: message };
  }
}

const rowsOf = (r: MetaAccountOutcome, key: "adRows" | "postRows") =>
  "adRows" in r ? Number(r[key] ?? 0) : 0;

/** Cuentas conectadas en orden estable por id, de a `limit` (máx. 3). */
export async function runMetaIngestBatch(opts: {
  offset: number;
  limit: number;
  date?: string;
  windowDays: number;
}): Promise<MetaIngestBatchSummary> {
  const limit = Math.min(META_MAX_BATCH_LIMIT, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);

  const { data, error } = await (supabaseAdmin.from("meta_accounts" as any) as any)
    .select("id,client_id,ad_account_id,ig_account_id,timezone_name")
    .eq("connected", true)
    .order("id", { ascending: true })
    // Uno extra para saber si queda otro lote.
    .range(offset, offset + limit);
  if (error) throw new Error(`No se pudieron listar las cuentas: ${error.message}`);

  const { batch, nextOffset } = splitBatch((data ?? []) as MetaAccountRow[], offset, limit);
  const results = await Promise.all(
    batch.map((account) => ingestOne(account, opts.date, opts.windowDays)),
  );

  const failed = results.filter((r) => r.error).length;
  const adRows = results.reduce((acc, r) => acc + rowsOf(r, "adRows"), 0);
  const postRows = results.reduce((acc, r) => acc + rowsOf(r, "postRows"), 0);
  return {
    offset,
    accounts: results.length,
    succeeded: results.length - failed,
    failed,
    rowsWritten: adRows + postRows,
    adRows,
    postRows,
    next_offset: nextOffset,
    results,
  };
}
