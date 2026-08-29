import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliverablesList } from "@/components/DeliverablesList";
import { ObjectivesList } from "@/components/ObjectivesList";

export const Route = createFileRoute("/_app/clients/$clientId/plan")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "objetivos" ? "objetivos" : "etapas",
  }),
  head: () => ({
    meta: [
      { title: "Plan del cliente | Vibranding" },
      { name: "description", content: "Etapas y objetivos del plan de trabajo del cliente." },
      { property: "og:title", content: "Plan del cliente | Vibranding" },
      { property: "og:description", content: "Etapas y objetivos del plan de trabajo del cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: { tab: v as "etapas" | "objetivos" } })}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="etapas">Etapas</TabsTrigger>
        <TabsTrigger value="objetivos">Objetivos</TabsTrigger>
      </TabsList>
      <TabsContent value="etapas">
        <DeliverablesList clientId={clientId} />
      </TabsContent>
      <TabsContent value="objetivos">
        <ObjectivesList clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
