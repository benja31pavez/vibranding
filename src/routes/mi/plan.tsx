import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/components/client-panel/PlanPage";

export const Route = createFileRoute("/mi/plan")({
  head: () => ({ meta: [{ title: "Plan | Vibranding" }] }),
  component: PlanPage,
});
