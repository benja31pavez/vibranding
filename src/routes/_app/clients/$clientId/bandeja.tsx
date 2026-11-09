import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  WhatsAppSectionPage,
  isWhatsAppTab,
  type WhatsAppTab,
} from "@/components/chatbot/WhatsAppSectionPage";

interface BandejaSearch {
  /** Subsección: resumen (por defecto), chatbot, bandeja o plantillas. */
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
  },
  head: () => ({
    meta: [
      { title: "WhatsApp del cliente | Vibranding" },
      {
        name: "description",
        content: "Resumen, chatbot, bandeja de mensajes y plantillas de WhatsApp del cliente.",
      },
      { property: "og:title", content: "WhatsApp del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Resumen, chatbot, bandeja de mensajes y plantillas de WhatsApp del cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BandejaRoute,
});

function BandejaRoute() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <WhatsAppSectionPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: () => ({ tab: next === "resumen" ? undefined : next }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
