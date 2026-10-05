import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICES } from "@/lib/services/content";
import { buildServiceHead } from "@/lib/services/seo";

const SERVICE = SERVICES["google-ads-pymes"];

export const Route = createFileRoute("/google-ads-pymes")({
  head: () => buildServiceHead(SERVICE),
  component: () => <ServicePage service={SERVICE} />,
});
