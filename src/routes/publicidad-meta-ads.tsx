import { createFileRoute } from "@tanstack/react-router";
import { ServicePage } from "@/components/services/ServicePage";
import { SERVICES } from "@/lib/services/content";
import { buildServiceHead } from "@/lib/services/seo";

const SERVICE = SERVICES["publicidad-meta-ads"];

export const Route = createFileRoute("/publicidad-meta-ads")({
  head: () => buildServiceHead(SERVICE),
  component: () => <ServicePage service={SERVICE} />,
});
