import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RE = /^\d{1,6}$/;
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 15; // mismo tope que MAX_BATCH_LIMIT (límite de subrequests del Worker)
/**
 * El cron (run_http_cron_job) llama una sola vez y sin offset: en ese caso se
 * encadenan lotes dentro de la misma petición hasta este tope (~9 consultas por
 * cliente → ~400 subrequests, bajo el límite de 1000 del Worker).
 */
const MAX_CLIENTS_PER_CRON_CALL = 45;

type BatchParams = { offset: number; limit: number; clientId?: string; chain: boolean };

function parseParams(params: URLSearchParams): BatchParams | { error: string } {
  const offset = params.get("offset") ?? "0";
  const limit = params.get("limit") ?? String(DEFAULT_LIMIT);
  const clientId = params.get("clientId") ?? undefined;
  if (!INT_RE.test(offset)) return { error: "offset debe ser un entero >= 0" };
  if (!INT_RE.test(limit) || Number(limit) < 1 || Number(limit) > MAX_LIMIT) {
    return { error: `limit debe estar entre 1 y ${MAX_LIMIT}` };
  }
  if (clientId && !UUID_RE.test(clientId)) return { error: "clientId debe ser un uuid" };
  // Sin offset explícito (llamada del cron) se recorren varios lotes seguidos.
  const chain = !params.has("offset") && !clientId;
  return { offset: Number(offset), limit: Number(limit), clientId, chain };
}

/**
 * Alertas automáticas de campañas. Lo llama el job 'campaign_alerts' todos los
 * días a las 13:00 UTC (≈10:00 en Chile), después de la ingesta diaria de Meta.
 * Protegido con el mismo x-dispatch-secret que meta/ingest-daily.
 * Evalúa clientes activos con Meta conectado por lotes (?offset=&limit=, tope
 * 15, concurrencia 3) y responde next_offset mientras queden clientes.
 * Sin ?offset (como llama el cron) encadena lotes hasta 45 clientes por
 * petición. ?clientId= evalúa solo ese cliente. Solo lee datos guardados: nunca llama a
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

        const { runCampaignAlertsChained } = await import("@/lib/alerts/campaignAlerts.server");
        try {
          const summary = await runCampaignAlertsChained(
            parsed,
            parsed.chain ? MAX_CLIENTS_PER_CRON_CALL : parsed.limit,
          );
          const status = summary.failed === 0 ? 200 : summary.evaluated > 0 ? 207 : 500;
          return Response.json(
            { ...summary, rowsWritten: summary.created + summary.updated + summary.resolved },
            { status },
          );
        } catch (e) {
          console.error("[alerts run] error", (e as Error).message);
          return Response.json({ error: "No se pudieron evaluar las alertas" }, { status: 500 });
        }
      },
    },
  },
});
