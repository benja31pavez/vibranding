import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentAutomationPanel } from "@/components/instagram/CommentAutomationPanel";
import { DmTriggersPanel } from "@/components/instagram/DmTriggersPanel";
import { Info } from "lucide-react";

type Tab = "comentarios" | "palabras-clave" | "bienvenida";
const TABS: Tab[] = ["comentarios", "palabras-clave", "bienvenida"];

export const Route = createFileRoute("/_app/clients/$clientId/automatizacion")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({
    tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Automatización de Instagram | Vibranding" },
      {
        name: "description",
        content:
          "Comentarios a DM, palabras clave en mensajes directos y bienvenida automática para Instagram.",
      },
      { property: "og:title", content: "Automatización de Instagram | Vibranding" },
      {
        property: "og:description",
        content: "Respuestas automáticas de Instagram: comentarios, palabras clave y bienvenida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationTabsPage,
});

function AutomationTabsPage() {
  const { clientId } = Route.useParams();
  const { tab = "comentarios" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => navigate({ search: { tab: v as Tab } })}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="comentarios">Comentarios a DM</TabsTrigger>
        <TabsTrigger value="palabras-clave">Palabras clave</TabsTrigger>
        <TabsTrigger value="bienvenida">Bienvenida</TabsTrigger>
      </TabsList>

      <TabsContent value="comentarios">
        <CommentAutomationPanel clientId={clientId} />
      </TabsContent>

      <TabsContent value="palabras-clave">
        <DmTriggersPanel clientId={clientId} kind="keyword" />
      </TabsContent>

      <TabsContent value="bienvenida" className="space-y-5">
        <div className="rounded-2xl border border-dashed bg-muted/40 p-4 text-sm space-y-2">
          <p className="flex items-center gap-2 font-medium">
            <Info className="w-4 h-4" /> Sobre los mensajes a nuevos seguidores
          </p>
          <p className="text-muted-foreground">
            Meta no expone un webhook de nuevo seguidor en la Graph API pública. El “seguir → DM”
            existe solo como beta privada, con ManyChat como socio exclusivo, y las cuentas con
            menos de ~1.000 seguidores por lo general no son elegibles. Por eso aquí no construimos
            ni prometemos mensajes disparados por seguimiento.
          </p>
          <p className="text-muted-foreground">
            La forma que sí cumple las reglas para saludar a nuevos seguidores es usar disparadores
            por <strong>palabra clave</strong>, por <strong>comentario</strong> o por{" "}
            <strong>respuesta a historia</strong>. Un comentario abre una ventana de mensajería de{" "}
            <strong>7 días</strong>; una respuesta a historia abre <strong>24 horas</strong>.
          </p>
        </div>
        <DmTriggersPanel clientId={clientId} kind="welcome" />
      </TabsContent>
    </Tabs>
  );
}
