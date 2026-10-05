import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

const INT_RE = /^\d{1,6}$/;
const DEFAULT_LIMIT = 8;
/** Tope por llamada: run_http_cron_job corta la petición a los 15 s. */
const MAX_LIMIT = 8;

function parseParams(
  params: URLSearchParams,
): { offset: number; limit: number } | { error: string } {
  const offset = params.get("offset") ?? "0";
  const limit = params.get("limit") ?? String(DEFAULT_LIMIT);
  if (!INT_RE.test(offset)) return { error: "offset debe ser un entero >= 0" };
  if (!INT_RE.test(limit) || Number(limit) < 1 || Number(limit) > MAX_LIMIT) {
    return { error: `limit debe estar entre 1 y ${MAX_LIMIT}` };
  }
  return { offset: Number(offset), limit: Number(limit) };
}

/**
 * Ingesta diaria de Google Ads (últimos 3 días, upsert idempotente en
 * google_ads_insights_daily). La llaman los jobs 'google_ads_ingest_<offset>'
 * (migración 20261012000400_cron_google_ads) con x-dispatch-secret.
 * Cada llamada procesa UN lote (?offset=&limit=, máx. 8) y responde next_offset.
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

        const parsed = parseParams(new URL(request.url).searchParams);
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

        const { getGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
        if (!getGoogleAdsConfig()) {
          // Sin credenciales pero con cuentas conectadas: la ingesta está rota
          // (503, visible en el health del job). Sin cuentas no es un fallo.
          const { countConnectedGoogleAdsAccounts } = await import(
            "@/lib/google-ads/connected.server"
          );
          const connected = await countConnectedGoogleAdsAccounts().catch((e: Error) => {
            console.error("[google ingest] no se pudieron contar las cuentas", e.message);
            return -1;
          });
          if (connected !== 0) {
            console.error("[google ingest] Google Ads no configurado con cuentas conectadas", {
              connected,
            });
            return Response.json(
              {
                error: "Google Ads no configurado y hay (o no se pudo descartar) cuentas conectadas",
                accounts: connected < 0 ? null : connected,
              },
              { status: 503 },
            );
          }
          return Response.json({
            skipped: "Google Ads no configurado",
            accounts: 0,
            rowsWritten: 0,
          });
        }

        const { runIngestBatch } = await import("@/lib/google-ads/ingest.server");
        try {
          const summary = await runIngestBatch(parsed);
          // Un lote que no escribió nada por errores nunca debe parecer éxito.
          const status = summary.failed === 0 ? 200 : summary.succeeded > 0 ? 207 : 500;
          return Response.json(summary, { status });
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
