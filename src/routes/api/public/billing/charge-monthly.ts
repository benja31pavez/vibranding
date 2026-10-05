import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { batchStatus } from "@/lib/cron/batch";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cobro mensual recurrente. Lo llama el job programado (1 vez al día);
 * protegido con el mismo x-dispatch-secret que meta/ingest-daily.
 * ?date=YYYY-MM-DD permite re-ejecutar un día pasado; nunca una fecha futura
 * (eso crearía cobros por adelantado).
 * 200 si todo salió bien; 500 si falló alguna suscripción (job_runs toma
 * cualquier 2xx, incluido 207, como éxito). El detalle va en el cuerpo.
 */
export const Route = createFileRoute("/api/public/billing/charge-monthly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[billing monthly] DISPATCH_SECRET missing — rejecting request");
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

        const date = new URL(request.url).searchParams.get("date");
        if (date && !DATE_RE.test(date)) {
          return Response.json({ error: "date debe ser YYYY-MM-DD" }, { status: 400 });
        }
        const { todayInChile } = await import("@/lib/billing/dates");
        if (date && date > todayInChile()) {
          return Response.json({ error: "date no puede ser futura" }, { status: 400 });
        }

        const { runMonthlyCharges } = await import("@/lib/billing/recurring.server");
        try {
          const summary = await runMonthlyCharges(date ?? undefined);
          return Response.json(
            { ...summary, rowsWritten: summary.paymentsCreated },
            { status: batchStatus(summary.failed) },
          );
        } catch (e) {
          console.error("[billing monthly] error", (e as Error).message);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
