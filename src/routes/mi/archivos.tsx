import { createFileRoute } from "@tanstack/react-router";
import { FilesPage } from "@/components/client-panel/FilesPage";

export const Route = createFileRoute("/mi/archivos")({
  head: () => ({ meta: [{ title: "Archivos | Vibranding" }] }),
  component: FilesPage,
});
