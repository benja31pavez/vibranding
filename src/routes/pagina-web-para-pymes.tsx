import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICES } from "@/lib/services/content";
import { buildServiceHead } from "@/lib/services/seo";

const SERVICE = SERVICES["pagina-web-para-pymes"];

export const Route = createFileRoute("/pagina-web-para-pymes")({
  head: () => buildServiceHead(SERVICE),
  component: () => <ServicePage service={SERVICE} />,
});
