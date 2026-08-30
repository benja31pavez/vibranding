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
  return <AnalyticsDashboard clientId={clientId} />;
}
