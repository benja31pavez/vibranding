import { createFileRoute } from "@tanstack/react-router";

/**
 * urlReturn de Flow: adonde vuelve el navegador del pagador.
 * La spec oficial no documenta el método para payment/create (en la práctica
 * Flow envía un POST con `token`), así que aceptamos GET y POST. No cambia
 * ningún dato: el pago solo se confirma en /api/public/flow/confirm.
 * 303 → la página pública /pago/resultado se carga siempre con GET.
 */
function toResult(request: Request): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: new URL("/pago/resultado", request.url).toString() },
  });
}

export const Route = createFileRoute("/api/public/flow/return")({
  server: {
    handlers: {
      GET: async ({ request }) => toResult(request),
      POST: async ({ request }) => toResult(request),
    },
  },
});
