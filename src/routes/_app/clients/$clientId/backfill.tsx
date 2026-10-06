import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app";
import { Button } from "@/components/ui/button";
import { OutcomeBackfill } from "@/components/chatbot/OutcomeBackfill";

const DESC =
  "Marca en lote el resultado de las conversaciones de WhatsApp para que la analítica calcule calificadas, cierres y ROAS.";

export const Route = createFileRoute("/_app/clients/$clientId/backfill")({
  head: () => ({
    meta: [
      { title: "Marcar resultados de conversaciones | Vibranding" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Marcar resultados de conversaciones | Vibranding" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackfillPage,
});

function BackfillPage() {
  const { clientId } = Route.useParams();
  return (
    <div className="space-y-4">
      <PageHeader
        size="compact"
        title="Resultados de conversaciones"
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link to="/clients/$clientId/analytics" params={{ clientId }}>
              <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" /> Analítica
            </Link>
          </Button>
        }
      />
      <OutcomeBackfill clientId={clientId} />
    </div>
  );
}
