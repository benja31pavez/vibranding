import { createFileRoute } from "@tanstack/react-router";
import { AdsPage } from "@/components/client-panel/AdsPage";

export const Route = createFileRoute("/mi/meta-ads")({
  head: () => ({ meta: [{ title: "Meta Ads | Vibranding" }] }),
  component: MetaAdsRoute,
});

function MetaAdsRoute() {
  return <AdsPage platform="meta" />;
}
