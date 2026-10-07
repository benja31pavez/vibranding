import { createFileRoute, redirect } from "@tanstack/react-router";
import { ClientPanelLayout } from "@/components/client-panel/ClientPanelLayout";
import { supabase } from "@/integrations/supabase/client";
import { resolveClientShellAccess } from "@/lib/auth/clientPanel";
import { parsePanelSearch } from "@/lib/auth/panelSearch";
import { NOINDEX_META } from "@/lib/site/robots";

/**
 * Panel del cliente (/mi/*): solo el panel izquierdo del cliente, sin header de
 * agencia. Ninguna ruta lleva clientId: el cliente sale de la sesión
 * (user_client_id() vía client_self y las server functions del portal).
 *
 * Guard: agencia → /dashboard; cliente sin client_users.panel_enabled → /portal.
 * Único parámetro de URL: `preview` (UUID), la vista previa de la agencia
 * ("Ver como cliente"). Solo cuenta para usuarios de agencia; el servidor lo
 * valida con getClientOrgRole antes de leer nada. Un cliente que lo envíe
 * vuelve a /mi sin el parámetro.
 * Si la verificación falla, no redirige aquí: ClientPanelLayout falla cerrado
 * (fondo vacío + Reintentar/Salir, nunca el contenido).
 */
export const Route = createFileRoute("/mi")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mi marca | Vibranding" }, NOINDEX_META] }),
  validateSearch: parsePanelSearch,
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw redirect({ to: "/login" });
    const access = await resolveClientShellAccess(userId, search.preview).catch(() => null);
    if (access?.kind === "redirect") throw redirect({ to: access.to, search: {} });
  },
  component: ClientPanelLayout,
});
