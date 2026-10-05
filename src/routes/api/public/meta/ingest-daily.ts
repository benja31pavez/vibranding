import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import {
  META_MAX_BATCH_LIMIT,
  batchStatus,
  missingBatchesError,
  parseBatchParams,
} from "@/lib/cron/batch";

/**
 * Ingesta diaria de insights de Meta. La llaman los jobs
 * 'meta_insights_daily_<offset>' (migración 20261012000600_cron_meta_lotes)
 * con x-dispatch-secret, para que nadie en internet pueda dispararla.
 * Cada llamada procesa UN lote de cuentas conectadas (?offset=&limit=, máx. 3,
 * orden estable por id) y responde next_offset. El último job lleva &last=1:
 * si aún quedan cuentas responde 500 ("faltan lotes"). ?date= y ?days= siguen
 * sirviendo para re-ingestas manuales.
 */
export const Route = createFileRoute("/api/public/meta/ingest-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[meta ingest] DISPATCH_SECRET missing — rejecting request");
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

        const url = new URL(request.url);
        const parsed = parseBatchParams(url.searchParams, {
          defaultLimit: META_MAX_BATCH_LIMIT,
          maxLimit: META_MAX_BATCH_LIMIT,
        });
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

        const { INGEST_WINDOW_DAYS } = await import("@/lib/meta/insights.server");
        const { runMetaIngestBatch } = await import("@/lib/meta/ingestBatch.server");
        const date = url.searchParams.get("date") ?? undefined;
        const windowDays = Number(url.searchParams.get("days") ?? INGEST_WINDOW_DAYS);

        try {
          const summary = await runMetaIngestBatch({ ...parsed, date, windowDays });
          const body = { date: date ?? null, windowDays, ...summary };
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[meta ingest]", missing);
            return Response.json({ ...body, error: missing }, { status: 500 });
          }
          // Un lote que no escribió nada por errores nunca debe parecer éxito.
          return Response.json(body, { status: batchStatus(summary.failed, summary.succeeded) });
        } catch (e) {
          console.error("[meta ingest] error", (e as Error).message);
          return Response.json(
            { error: "No se pudo ejecutar la ingesta de Meta" },
            { status: 500 },
          );
        }
      },
    },
  },
});
