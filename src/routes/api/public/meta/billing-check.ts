import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import {
  CRON_CALL_BUDGET_MS,
  batchStatus,
  missingBatchesError,
  parseBatchParams,
} from "@/lib/cron/batch";

/** Igual que BILLING_MAX_BATCH_LIMIT de billing.server (no se importa: es solo servidor). */
const MAX_LIMIT = 10;

/**
 * Chequeo diario del pago de pauta en Meta. Lo llaman los jobs
 * 'meta_billing_check_<offset>' (migración 20261012001600_onboarding_pago_pauta)
 * con x-dispatch-secret. Cada llamada revisa UN lote de cuentas publicitarias
 * conectadas (?offset=&limit=, máx. 10, orden estable por id): guarda el estado
 * en meta_billing_status y abre/cierra la alerta 'billing_meta' en Inicio.
 * Nunca toca campañas ni envía mensajes. Cualquier fallo responde 500 (job_runs
 * toma todo 2xx como éxito); el último job lleva &last=1 y avisa si faltan lotes.
 */
export const Route = createFileRoute("/api/public/meta/billing-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deadlineMs = Date.now() + CRON_CALL_BUDGET_MS;
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[meta billing] DISPATCH_SECRET missing — rejecting request");
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
          const { runMetaBillingBatch } = await import("@/lib/meta/billing.server");
          const summary = await runMetaBillingBatch({ ...parsed, deadlineMs });
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[meta billing]", missing);
            return Response.json({ ...summary, error: missing }, { status: 500 });
          }
          return Response.json(summary, { status: batchStatus(summary.failed) });
        } catch (e) {
          console.error("[meta billing] error", (e as Error).message);
          return Response.json(
            { error: "No se pudo revisar el pago de pauta en Meta" },
            { status: 500 },
          );
        }
      },
    },
  },
});
