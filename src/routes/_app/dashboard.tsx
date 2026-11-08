import { createFileRoute } from "@tanstack/react-router";
import { DashboardHoy } from "@/components/dashboard";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Inicio | Vibranding" }] }),
  component: DashboardHoy,
});
