import { createFileRoute } from "@tanstack/react-router";
import { SummaryPage } from "@/components/client-panel/SummaryPage";

export const Route = createFileRoute("/mi/")({
  head: () => ({ meta: [{ title: "Resumen | Vibranding" }] }),
  component: SummaryPage,
});
