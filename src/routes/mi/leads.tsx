import { createFileRoute } from "@tanstack/react-router";
import { LeadsPage } from "@/components/client-panel/LeadsPage";

export const Route = createFileRoute("/mi/leads")({
  head: () => ({ meta: [{ title: "Leads | Vibranding" }] }),
  component: LeadsPage,
});
