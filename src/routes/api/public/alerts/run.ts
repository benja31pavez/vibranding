import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { batchStatus, missingBatchesError, parseBatchParams } from "@/lib/cron/batch";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Lote por defecto: cabe holgado en los 15 s de run_http_cron_job. */
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 15; // mismo tope que MAX_BATCH_LIMIT (límite de subrequests del Worker)

type AlertsParams = { offset: number; limit: number; last: boolean; clientId?: string };

function parseParams(params: URLSearchParams): AlertsParams | { error: string } {
  const batch = parseBatchParams(params, { defaultLimit: DEFAULT_LIMIT, maxLimit: MAX_LIMIT });
  if ("error" in batch) return batch;
  const clientId = params.get("clientId") ?? undefined;
  if (clientId && !UUID_RE.test(clientId)) return { error: "clientId debe ser un uuid" };
  return { ...batch, clientId };
}

/**
 * Alertas automáticas de campañas. Lo llaman los jobs 'campaign_alerts_<offset>' todos los
 * días desde las 13:00 UTC (≈10:00 en Chile), después de la ingesta diaria de Meta.
 * Protegido con el mismo x-dispatch-secret que meta/ingest-daily.
 * Cada llamada evalúa UN lote de clientes activos con Meta conectado
 * (?offset=&limit=, por defecto 8, tope 15, concurrencia 3) y responde
 * next_offset si quedan más. El cron cubre los lotes con un job por offset
 * (campaign_alerts_0, _8, _16…; ver migración 20261012000100_cron_alertas).
 * El último job lleva &last=1: si aún quedan clientes responde 500 ("faltan lotes").
 * ?clientId= evalúa solo ese cliente. Solo lee datos guardados: nunca llama a
 * Meta ni cambia campañas.
 */
export const Route = createFileRoute("/api/public/alerts/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[alerts run] DISPATCH_SECRET missing — rejecting request");
          return new Response("Server misconfigured", { status: 500 });
        }
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

        const { runCampaignAlerts } = await import("@/lib/alerts/campaignAlerts.server");
        try {
          const summary = await runCampaignAlerts(parsed);
          const body = {
            ...summary,
            rowsWritten: summary.created + summary.updated + summary.resolved,
          };
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[alerts run]", missing);
            return Response.json({ ...body, error: missing }, { status: 500 });
          }
          return Response.json(body, { status: batchStatus(summary.failed, summary.evaluated) });
        } catch (e) {
          console.error("[alerts run] error", (e as Error).message);
          return Response.json({ error: "No se pudieron evaluar las alertas" }, { status: 500 });
        }
      },
    },
  },
});
