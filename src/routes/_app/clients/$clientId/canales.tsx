import { createFileRoute } from "@tanstack/react-router";
import {
  CanalesPage,
  isCanalesTab,
  isInstagramTab,
  isWhatsAppTab,
  type CanalesTab,
} from "@/components/canales/CanalesPage";
import type { InstagramTab } from "@/components/instagram/InstagramSectionPage";
import type { WhatsAppTab } from "@/components/chatbot/WhatsAppSectionPage";

interface CanalesSearch {
  /** Subsección de Canales: resumen (por defecto), instagram, whatsapp o mensajes. */
  tab?: CanalesTab;
  /** Subpestaña dentro de Instagram (resumen/publicaciones/audiencia/mensajes). */
  igsub?: InstagramTab;
  /** Subpestaña dentro de WhatsApp (resumen/chatbot/bandeja/plantillas). */
  wasub?: WhatsAppTab;
}

export const Route = createFileRoute("/_app/clients/$clientId/canales")({
  validateSearch: (s: Record<string, unknown>): CanalesSearch => ({
    tab: isCanalesTab(s.tab) ? s.tab : undefined,
    igsub: isInstagramTab(s.igsub) ? s.igsub : undefined,
    wasub: isWhatsAppTab(s.wasub) ? s.wasub : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Canales del cliente | Vibranding" },
      {
        name: "description",
        content: "Instagram, WhatsApp y bandeja unificada del cliente en una sola pantalla.",
      },
      { property: "og:title", content: "Canales del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Instagram, WhatsApp y bandeja unificada del cliente en una sola pantalla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CanalesRoute,
});

function CanalesRoute() {
  const { clientId } = Route.useParams();
  const { tab, igsub, wasub } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <CanalesPage
      clientId={clientId}
      tab={tab ?? "resumen"}
      onTabChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            tab: next === "resumen" ? undefined : next,
          }),
          replace: true,
          resetScroll: false,
        })
      }
      igSub={igsub ?? "resumen"}
      onIgSubChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            igsub: next === "resumen" ? undefined : next,
          }),
          replace: true,
          resetScroll: false,
        })
      }
      waSub={wasub ?? "resumen"}
      onWaSubChange={(next) =>
        navigate({
          search: (prev) => ({
            ...prev,
            wasub: next === "resumen" ? undefined : next,
          }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
