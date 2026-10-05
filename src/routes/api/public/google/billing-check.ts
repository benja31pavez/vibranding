import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { batchStatus, missingBatchesError, parseBatchParams } from "@/lib/cron/batch";

const DEFAULT_LIMIT = 8;
/** Tope por llamada: run_http_cron_job corta la petición a los 15 s. */
const MAX_LIMIT = 8;

/**
 * Chequeo diario de facturación de Google Ads: customer.status, billing_setup
 * y account_budget de cada cuenta conectada → google_ads_billing_status, y
 * alerta 'billing_google' en campaign_alerts si el pago no está verificado.
 * La llaman los jobs 'google_ads_billing_<offset>' (migración
 * 20261012001510_cron_google_billing) con x-dispatch-secret.
 * Un lote por llamada (?offset=&limit=, máx. 8, ~12 s de presupuesto; lo que no alcanza cuenta como fallo) con next_offset; el último job
 * lleva &last=1 y responde 500 si aún quedan cuentas. Cualquier fallo → 500.
 * Solo lectura en Google: nunca crea, activa ni pausa campañas.
 */
export const Route = createFileRoute("/api/public/google/billing-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[google billing] DISPATCH_SECRET missing — rejecting request");
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

        const parsed = parseBatchParams(new URL(request.url).searchParams, {
          defaultLimit: DEFAULT_LIMIT,
          maxLimit: MAX_LIMIT,
        });
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

        const { getGoogleAdsConfig } = await import("@/lib/google-ads/config.server");
        if (!getGoogleAdsConfig()) {
          const { countConnectedGoogleAdsAccounts } =
            await import("@/lib/google-ads/connected.server");
          const connected = await countConnectedGoogleAdsAccounts().catch((e: Error) => {
            console.error("[google billing] no se pudieron contar las cuentas", e.message);
            return -1;
          });
          if (connected !== 0) {
            console.error("[google billing] Google Ads no configurado con cuentas conectadas", {
              connected,
            });
            return Response.json(
              {
                error:
                  "Google Ads no configurado y hay (o no se pudo descartar) cuentas conectadas",
                accounts: connected < 0 ? null : connected,
              },
              { status: 503 },
            );
          }
          return Response.json({ skipped: "Google Ads no configurado", accounts: 0 });
        }

        const { runBillingBatch } = await import("@/lib/google-ads/billing.server");
        try {
          const summary = await runBillingBatch({ ...parsed, startedAt });
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[google billing]", missing);
            return Response.json({ ...summary, error: missing }, { status: 500 });
          }
          return Response.json(summary, { status: batchStatus(summary.failed) });
        } catch (e) {
          console.error("[google billing] error", (e as Error).message);
          return Response.json(
            { error: "No se pudo ejecutar el chequeo de facturación de Google Ads" },
            { status: 500 },
          );
        }
      },
    },
  },
});
