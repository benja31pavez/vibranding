import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICES } from "@/lib/services/content";
import { buildServiceHead } from "@/lib/services/seo";

const SERVICE = SERVICES["agencia-marketing-digital-santiago"];

export const Route = createFileRoute("/agencia-marketing-digital-santiago")({
  head: () => buildServiceHead(SERVICE),
  component: () => <ServicePage service={SERVICE} />,
});
