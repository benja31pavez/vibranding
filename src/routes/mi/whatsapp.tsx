import { createFileRoute } from "@tanstack/react-router";
import { WhatsAppPage } from "@/components/client-panel/WhatsAppPage";

export const Route = createFileRoute("/mi/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp | Vibranding" }] }),
  component: WhatsAppPage,
});
