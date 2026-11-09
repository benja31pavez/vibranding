import { createFileRoute } from "@tanstack/react-router";
import { ClientsListPage } from "@/components/clients/list/ClientsListPage";

export const Route = createFileRoute("/_app/clients/")({
  head: () => ({ meta: [{ title: "Clientes | Vibranding" }] }),
  component: ClientsListPage,
});
