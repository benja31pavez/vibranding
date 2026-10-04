import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { defaultReportPeriod } from "@/lib/reports/period";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RE = /^\d{1,6}$/;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 15; // mismo tope que MAX_BATCH_LIMIT (límite de subrequests del Worker)

type BatchParams = { period?: string; offset: number; limit: number; clientId?: string };

function parseParams(params: URLSearchParams): BatchParams | { error: string } {
  const period = params.get("period") ?? undefined;
  const offset = params.get("offset") ?? "0";
  const limit = params.get("limit") ?? String(DEFAULT_LIMIT);
  const clientId = params.get("clientId") ?? undefined;
  if (period && !PERIOD_RE.test(period)) return { error: "period debe ser YYYY-MM-01" };
  if (period && period > defaultReportPeriod()) return { error: "period debe ser un mes ya cerrado" };
  if (!INT_RE.test(offset)) return { error: "offset debe ser un entero >= 0" };
  if (!INT_RE.test(limit) || Number(limit) < 1 || Number(limit) > MAX_LIMIT) {
    return { error: `limit debe estar entre 1 y ${MAX_LIMIT}` };
  }
  if (clientId && !UUID_RE.test(clientId)) return { error: "clientId debe ser un uuid" };
  return { period, offset: Number(offset), limit: Number(limit), clientId };
}

/**
 * Reporte mensual automático. Lo llama el job programado el día 1 a las 09:00
 * (hora de Chile) y genera el reporte del mes anterior para cada cliente activo.
 * Protegido con el mismo x-dispatch-secret que meta/ingest-daily.
 * Procesa por lotes (?offset=&limit=, por defecto 10, concurrencia 3) y responde
 * next_offset mientras queden clientes; el cron vuelve a llamar con ese offset
 * hasta que sea null. ?clientId= procesa solo ese cliente activo y
 * ?period=YYYY-MM-01 regenera otro mes ya cerrado. Los reportes ya enviados no
 * se pisan (skipped_sent).
 */
export const Route = createFileRoute("/api/public/reports/monthly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[reports monthly] DISPATCH_SECRET missing — rejecting request");
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

        const params = new URL(request.url).searchParams;
        const parsed = parseParams(params);
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

        const { generateReportsForActiveClients } = await import("@/lib/reports/monthly.server");
        try {
          const summary = await generateReportsForActiveClients(parsed);
          const ok = summary.generated + summary.skipped_sent;
          const status = summary.failed === 0 ? 200 : ok > 0 ? 207 : 500;
          return Response.json({ ...summary, rowsWritten: summary.generated }, { status });
        } catch (e) {
          console.error("[reports monthly] error", (e as Error).message);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
