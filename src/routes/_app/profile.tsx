import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/profile/ProfileDialog";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Editar perfil | Vibranding" },
      {
        name: "description",
        content: "Actualiza tus datos personales y tu foto de perfil en Vibranding.",
      },
      { property: "og:title", content: "Editar perfil | Vibranding" },
      {
        property: "og:description",
        content: "Actualiza tus datos personales y tu foto de perfil en Vibranding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});
