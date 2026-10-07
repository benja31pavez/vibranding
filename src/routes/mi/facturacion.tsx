import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/client-panel/BillingPage";

export const Route = createFileRoute("/mi/facturacion")({
  head: () => ({ meta: [{ title: "Facturación | Vibranding" }] }),
  component: BillingPage,
});
