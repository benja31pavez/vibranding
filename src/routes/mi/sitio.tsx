import { createFileRoute } from "@tanstack/react-router";
import { SitePage } from "@/components/client-panel/SitePage";

export const Route = createFileRoute("/mi/sitio")({
  head: () => ({ meta: [{ title: "Sitio | Vibranding" }] }),
  component: SitePage,
});
