import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliverablesList } from "@/components/DeliverablesList";
import { ObjectivesList } from "@/components/ObjectivesList";
import { ClientTasksList } from "@/components/ClientTasksList";

type TabKey = "etapas" | "objetivos" | "tareas";

export const Route = createFileRoute("/_app/clients/$clientId/plan")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => ({
    tab:
      s.tab === "objetivos" ? "objetivos"
      : s.tab === "tareas" ? "tareas"
      : s.tab === "etapas" ? "etapas"
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Plan del cliente | Vibranding" },
      { name: "description", content: "Etapas, objetivos y tareas del plan de trabajo del cliente." },
      { property: "og:title", content: "Plan del cliente | Vibranding" },
      { property: "og:description", content: "Etapas, objetivos y tareas del plan de trabajo del cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { clientId } = Route.useParams();
  const { tab = "etapas" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: { tab: v as TabKey } })}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="etapas">Etapas</TabsTrigger>
        <TabsTrigger value="objetivos">Objetivos</TabsTrigger>
        <TabsTrigger value="tareas">Tareas</TabsTrigger>
      </TabsList>
      <TabsContent value="etapas">
        <DeliverablesList clientId={clientId} />
      </TabsContent>
      <TabsContent value="objetivos">
        <ObjectivesList clientId={clientId} />
      </TabsContent>
      <TabsContent value="tareas">
        <ClientTasksList clientId={clientId} />
      </TabsContent>
    </Tabs>
  );
}
