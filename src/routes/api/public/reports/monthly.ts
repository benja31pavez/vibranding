import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;

/**
 * Reporte mensual automático. Lo llama el job programado el día 1 a las 09:00
 * (hora de Chile) y genera el reporte del mes anterior para cada cliente activo.
 * Protegido con el mismo x-dispatch-secret que meta/ingest-daily.
 * ?period=YYYY-MM-01 permite regenerar otro mes.
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

        const period = new URL(request.url).searchParams.get("period");
        if (period && !PERIOD_RE.test(period)) {
          return Response.json({ error: "period debe ser YYYY-MM-01" }, { status: 400 });
        }

        const { generateReportsForActiveClients } = await import("@/lib/reports/monthly.server");
        try {
          const summary = await generateReportsForActiveClients(period ?? undefined);
          const status = summary.failed === 0 ? 200 : summary.generated > 0 ? 207 : 500;
          return Response.json({ ...summary, rowsWritten: summary.generated }, { status });
        } catch (e) {
          console.error("[reports monthly] error", (e as Error).message);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
