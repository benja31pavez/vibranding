import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatbotPage } from "@/components/pages/ChatbotPage";
import { LeadsPage } from "@/components/pages/LeadsPage";

export const Route = createFileRoute("/_app/clients/$clientId/bandeja")({
  validateSearch: (s: Record<string, unknown>): { tab?: "whatsapp" | "leads" } => ({
    tab: s.tab === "leads" ? "leads" : s.tab === "whatsapp" ? "whatsapp" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Bandeja del cliente | Vibranding" },
      { name: "description", content: "Conversaciones de WhatsApp e Instagram junto a todos los leads." },
      { property: "og:title", content: "Bandeja del cliente | Vibranding" },
      { property: "og:description", content: "Conversaciones de WhatsApp e Instagram junto a todos los leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BandejaPage,
});

function BandejaPage() {
  const { clientId } = Route.useParams();
  const { tab = "whatsapp" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: { tab: v as "whatsapp" | "leads" } })}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
      </TabsList>
      <TabsContent value="whatsapp">
        <ChatbotPage clientId={clientId} />
      </TabsContent>
      <TabsContent value="leads">
        <LeadsPage clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
