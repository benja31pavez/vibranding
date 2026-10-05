import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { batchStatus, missingBatchesError, parseBatchParams } from "@/lib/cron/batch";

const DEFAULT_LIMIT = 8;
/** Tope por llamada: run_http_cron_job corta la petición a los 15 s. */
const MAX_LIMIT = 8;

/**
 * Ingesta diaria de Google Ads (últimos 3 días, upsert idempotente en
 * google_ads_insights_daily). La llaman los jobs 'google_ads_ingest_<offset>'
 * (migración 20261012000400_cron_google_ads) con x-dispatch-secret.
 * Cada llamada procesa UN lote (?offset=&limit=, máx. 8) y responde next_offset.
 * El último job lleva &last=1: si aún quedan cuentas responde 500 ("faltan lotes").
 * Solo lectura en Google: nunca crea ni modifica campañas.
 */
export const Route = createFileRoute("/api/public/google/ingest-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[google ingest] DISPATCH_SECRET missing — rejecting request");
          return new Response("Server misconfigured", { status: 500 });
        }
        // Comparación en tiempo constante: se comparan HMAC de igual largo.
        const provided = request.headers.get("x-dispatch-secret") ?? "";
        const [a, b] = await Promise.all([
          hmacSha256Hex(expected, provided),
          hmacSha256Hex(expected, expected),
        ]);
        if (!provided || !timingSafeEqualHex(a, b)) {
          return new Response("Forbidden", { status: 403 });
        }

        const parsed = parseBatchParams(new URL(request.url).searchParams, {
          defaultLimit: DEFAULT_LIMIT,
          maxLimit: MAX_LIMIT,
        });
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

        const { getGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
        if (!getGoogleAdsConfig()) {
          // Sin credenciales no hay nada que hacer; no es un fallo del job.
          return Response.json({
            skipped: "Google Ads no configurado",
            accounts: 0,
            rowsWritten: 0,
          });
        }

        const { runIngestBatch } = await import("@/lib/google-ads/ingest.server");
        try {
          const summary = await runIngestBatch(parsed);
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[google ingest]", missing);
            return Response.json({ ...summary, error: missing }, { status: 500 });
          }
          // Un lote que no escribió nada por errores nunca debe parecer éxito.
          return Response.json(summary, { status: batchStatus(summary.failed, summary.succeeded) });
        } catch (e) {
          console.error("[google ingest] error", (e as Error).message);
          return Response.json(
            { error: "No se pudo ejecutar la ingesta de Google Ads" },
            { status: 500 },
          );
        }
      },
    },
  },
});
