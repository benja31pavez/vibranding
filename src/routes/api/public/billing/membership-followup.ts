import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import { batchStatus, missingBatchesError, parseBatchParams } from "@/lib/cron/batch";

const MAX_LIMIT = 10;

/**
 * Correo de seguimiento de la membresía (3 días antes del fin del período, si no
 * renovó). Lo llaman los jobs 'membership_followup_<offset>' (migración
 * 20261012002510_cron_membresia) con x-dispatch-secret. Cada llamada procesa UN
 * lote (?offset=&limit=, máx. 10, orden estable por id). Idempotente
 * (payments.followup_sent_at). Cualquier falla responde 500; el último job lleva &last=1.
 */
export const Route = createFileRoute("/api/public/billing/membership-followup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[membresía seguimiento] DISPATCH_SECRET missing — rejecting request");
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
          defaultLimit: MAX_LIMIT,
          maxLimit: MAX_LIMIT,
        });
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

        try {
          const { runMembershipFollowupBatch } =
            await import("@/lib/billing/membershipFollowup.server");
          const summary = await runMembershipFollowupBatch(parsed);
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[membresía seguimiento]", missing);
            return Response.json({ ...summary, error: missing }, { status: 500 });
          }
          return Response.json(
            { ...summary, rowsWritten: summary.sent },
            { status: batchStatus(summary.failed) },
          );
        } catch (e) {
          console.error("[membresía seguimiento] error", (e as Error).message);
          return Response.json(
            { error: "No se pudo enviar el seguimiento de la membresía" },
            { status: 500 },
          );
        }
      },
    },
  },
});
