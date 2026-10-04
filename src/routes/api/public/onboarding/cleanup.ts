import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

/**
 * Limpieza de archivos huérfanos del onboarding (bucket privado 'onboarding').
 * Cron diario (p. ej. 04:00 hora de Chile):
 *   POST /api/public/onboarding/cleanup  con header x-dispatch-secret: $DISPATCH_SECRET
 * Protegido con el mismo x-dispatch-secret que reports/monthly y meta/ingest-daily.
 * Responde { found, removed, failed, reasons, truncated }; si truncated es true
 * quedan paths para la próxima corrida (o se puede volver a llamar).
 */
export const Route = createFileRoute("/api/public/onboarding/cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[onboarding cleanup] DISPATCH_SECRET missing — rejecting request");
          return new Response("Server misconfigured", { status: 500 });
        }
        const provided = request.headers.get("x-dispatch-secret") ?? "";
        const [a, b] = await Promise.all([hmacSha256Hex(expected, provided), hmacSha256Hex(expected, expected)]);
        if (!provided || !timingSafeEqualHex(a, b)) {
          return new Response("Forbidden", { status: 403 });
        }

        const { cleanupOnboardingOrphans } = await import("@/lib/onboarding/cleanup.server");
        try {
          const summary = await cleanupOnboardingOrphans();
          const status = summary.failed === 0 ? 200 : summary.removed > 0 ? 207 : 500;
          return Response.json(summary, { status });
        } catch (e) {
          console.error("[onboarding cleanup] error", (e as Error).message);
          return Response.json({ error: "No se pudo limpiar el onboarding" }, { status: 500 });
        }
      },
    },
  },
});
