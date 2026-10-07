import { createFileRoute } from "@tanstack/react-router";
import { AdsPage } from "@/components/client-panel/AdsPage";

export const Route = createFileRoute("/mi/google-ads")({
  head: () => ({ meta: [{ title: "Google Ads | Vibranding" }] }),
  component: GoogleAdsRoute,
});

function GoogleAdsRoute() {
  return <AdsPage platform="google" />;
}
