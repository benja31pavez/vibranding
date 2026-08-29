import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultilinkPage } from "@/components/pages/MultilinkPage";
import { LandingEditor } from "@/components/pages/LandingEditor";

export const Route = createFileRoute("/_app/clients/$clientId/sitio")({
  validateSearch: (s: Record<string, unknown>): { tab?: "multienlace" | "landing" } => ({
    tab: s.tab === "landing" ? "landing" : s.tab === "multienlace" ? "multienlace" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sitio del cliente | Vibranding" },
      { name: "description", content: "Multienlace y landing page del cliente en un solo lugar." },
      { property: "og:title", content: "Sitio del cliente | Vibranding" },
      { property: "og:description", content: "Multienlace y landing page del cliente en un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SitioPage,
});

function SitioPage() {
  const { clientId } = Route.useParams();
  const { tab = "multienlace" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: { tab: v as "multienlace" | "landing" } })}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="multienlace">Multienlace</TabsTrigger>
        <TabsTrigger value="landing">Landing page</TabsTrigger>
      </TabsList>
      <TabsContent value="multienlace">
        <MultilinkPage clientId={clientId} />
      </TabsContent>
      <TabsContent value="landing">
        <LandingEditor clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
