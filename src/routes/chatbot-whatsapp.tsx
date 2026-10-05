import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICES } from "@/lib/services/content";
import { buildServiceHead } from "@/lib/services/seo";

const SERVICE = SERVICES["chatbot-whatsapp"];

export const Route = createFileRoute("/chatbot-whatsapp")({
  head: () => buildServiceHead(SERVICE),
  component: () => <ServicePage service={SERVICE} />,
});
