import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site";

const RESULT_PATH = "/pago/resultado";

/**
 * urlReturn de Flow: adonde vuelve el navegador del pagador.
 * La spec oficial no documenta el método para payment/create (en la práctica
 * Flow envía un POST con `token`), así que aceptamos GET y POST. No cambia
 * ningún dato: el pago solo se confirma en /api/public/flow/confirm.
 * 303 → /pago/resultado en el origen canónico (PUBLIC_SITE_URL), nunca en el
 * Host de la petición (si falta, SITE_URL de src/lib/site.ts).
 */
async function toResult(): Promise<Response> {
  // Sin PUBLIC_SITE_URL se vuelve al dominio de producción (nunca un Location relativo).
  let location = `${SITE_URL}${RESULT_PATH}`;
  try {
    const { publicOrigin } = await import("@/lib/meta/oauth.server");
    location = `${publicOrigin()}${RESULT_PATH}`;
  } catch (e) {
    console.error(
      "[flow return] PUBLIC_SITE_URL no configurada; uso SITE_URL",
      (e as Error).message,
    );
  }
  return new Response(null, { status: 303, headers: { Location: location } });
}

export const Route = createFileRoute("/api/public/flow/return")({
  server: {
    handlers: {
      GET: async () => toResult(),
      POST: async () => toResult(),
    },
  },
});
