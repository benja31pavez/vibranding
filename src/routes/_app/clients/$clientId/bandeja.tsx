import { createFileRoute, redirect } from "@tanstack/react-router";
import { isWhatsAppTab, type WhatsAppTab } from "@/components/chatbot/WhatsAppSectionPage";

interface BandejaSearch {
  /** Compatibilidad con enlaces antiguos: subpestaña de WhatsApp. */
  tab?: WhatsAppTab;
  /** Enlace antiguo `?tab=leads`: se redirige a la sección Leads. */
  legacy?: "leads";
}

/** Pestañas del diseño anterior: los enlaces viejos siguen funcionando. */
const LEGACY_TABS: Record<string, WhatsAppTab> = {
  whatsapp: "bandeja",
  conversations: "bandeja",
  rules: "chatbot",
  ai: "chatbot",
  profile: "chatbot",
  metrics: "resumen",
};

/**
 * Ruta antigua: WhatsApp ahora es una subpestaña dentro de Canales (`/canales?tab=whatsapp`).
 * Se preservan los enlaces viejos redirigiendo al nuevo destino, con la subpestaña interna
 * trasladada al search param `wasub`.
 */
export const Route = createFileRoute("/_app/clients/$clientId/bandeja")({
  validateSearch: (s: Record<string, unknown>): BandejaSearch => ({
    tab: isWhatsAppTab(s.tab)
      ? s.tab
      : typeof s.tab === "string" && LEGACY_TABS[s.tab]
        ? LEGACY_TABS[s.tab]
        : undefined,
    legacy: s.tab === "leads" ? "leads" : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    if (search.legacy === "leads") {
      throw redirect({ to: "/clients/$clientId/leads", params });
    }
    throw redirect({
      to: "/clients/$clientId/canales",
      params,
      search: { tab: "whatsapp", wasub: search.tab },
    });
  },
});
