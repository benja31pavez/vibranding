import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/client-panel/CalendarPage";

export const Route = createFileRoute("/mi/calendario")({
  head: () => ({ meta: [{ title: "Calendario | Vibranding" }] }),
  component: CalendarPage,
});
