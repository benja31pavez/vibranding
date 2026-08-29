import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Resultados de conversaciones</h1>
          <p className="text-sm text-muted-foreground">{DESC}</p>
        </div>
        <Link
          to="/clients/$clientId/analytics"
          params={{ clientId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Analítica
        </Link>
      </div>
      <OutcomeBackfill clientId={clientId} />
    </div>
  );
}
