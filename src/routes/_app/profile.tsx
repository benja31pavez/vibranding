import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/profile/ProfilePage";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Editar perfil | Vibranding" },
      {
        name: "description",
        content:
          "Tus datos personales, los de la agencia, la contraseña y las preferencias de Vibranding.",
      },
      { property: "og:title", content: "Editar perfil | Vibranding" },
      {
        property: "og:description",
        content:
          "Tus datos personales, los de la agencia, la contraseña y las preferencias de Vibranding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});
