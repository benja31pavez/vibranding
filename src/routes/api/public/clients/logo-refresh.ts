import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import {
  CRON_CALL_BUDGET_MS,
  batchStatus,
  missingBatchesError,
  parseBatchParams,
} from "@/lib/cron/batch";

/** Igual que LOGO_MAX_BATCH_LIMIT de logoCron.server (no se importa: es solo servidor). */
const MAX_LIMIT = 5;

/**
 * Refresco semanal del logo de los clientes desde la foto de perfil de
 * Instagram. Lo llaman los jobs 'client_logo_refresh_<offset>' (migración
 * 20261012002110_cron_logo_clientes) con x-dispatch-secret. Cada llamada
 * procesa UN lote (?offset=&limit=, máx. 5, orden estable por id). Nunca pisa
 * logos subidos a mano. Cuentas personales o sin @ cuentan como "skipped" (no
 * es falla). Cualquier falla real responde 500; el último job lleva &last=1.
 */
export const Route = createFileRoute("/api/public/clients/logo-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deadlineMs = Date.now() + CRON_CALL_BUDGET_MS;
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[client-logo cron] DISPATCH_SECRET missing — rejecting request");
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
          defaultLimit: MAX_LIMIT,
          maxLimit: MAX_LIMIT,
        });
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

        try {
          const { runLogoRefreshBatch } = await import("@/lib/clients/logoCron.server");
          const summary = await runLogoRefreshBatch({ ...parsed, deadlineMs });
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[client-logo cron]", missing);
            return Response.json({ ...summary, error: missing }, { status: 500 });
          }
          return Response.json(summary, { status: batchStatus(summary.failed) });
        } catch (e) {
          console.error("[client-logo cron] error", (e as Error).message);
          return Response.json(
            { error: "No se pudieron refrescar los logos de los clientes" },
            { status: 500 },
          );
        }
      },
    },
  },
});
