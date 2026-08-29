import { createFileRoute } from "@tanstack/react-router";
import { ContentCalendar } from "@/components/instagram/ContentCalendar";

export const Route = createFileRoute("/_app/clients/$clientId/content")({
  head: () => ({
    meta: [
      { title: "Calendario de contenido | Vibranding" },
      {
        name: "description",
        content:
          "Planifica publicaciones de Instagram en vista mes o semana, arrastra para reprogramar y compara interacción real contra el horario.",
      },
      { property: "og:title", content: "Calendario de contenido | Vibranding" },
      {
        property: "og:description",
        content:
          "Planifica publicaciones de Instagram en vista mes o semana, arrastra para reprogramar y compara interacción real contra el horario.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentPage,
});

function ContentPage() {
  const { clientId } = Route.useParams();
  return <ContentCalendar clientId={clientId} />;
}
