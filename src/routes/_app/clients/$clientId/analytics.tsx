import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { AudiencePanel } from "@/components/analytics/AudiencePanel";

export const Route = createFileRoute("/_app/clients/$clientId/analytics")({
  head: () => ({
    meta: [
      { title: "Analítica del cliente | Vibranding" },
      {
        name: "description",
        content:
          "Embudo de conversaciones, costo por conversación calificada, CAC, ROAS y tiempos de respuesta por campaña.",
      },
      { property: "og:title", content: "Analítica del cliente | Vibranding" },
      {
        property: "og:description",
        content:
          "Embudo de conversaciones, costo por conversación calificada, CAC, ROAS y tiempos de respuesta por campaña.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { clientId } = Route.useParams();
  return (
    <Tabs defaultValue="rendimiento" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
        <TabsTrigger value="audiencia">Audiencia</TabsTrigger>
      </TabsList>
      <TabsContent value="rendimiento">
        <AnalyticsDashboard clientId={clientId} />
      </TabsContent>
      <TabsContent value="audiencia">
        <AudiencePanel clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
