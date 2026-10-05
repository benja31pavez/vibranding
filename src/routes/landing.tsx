import { createFileRoute } from "@tanstack/react-router";
import { MARKETING_META, MARKETING_ORG_SCRIPT } from "@/lib/marketingSeo";
import { Landing } from "@/components/home/Landing";
import { fetchPublicPortfolio } from "@/lib/portfolio";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      ...MARKETING_META,
      { title: "Vibranding — Landing (preview)" },
      { name: "robots", content: "noindex" },
    ],
    scripts: [MARKETING_ORG_SCRIPT],
  }),
  loader: () => fetchPublicPortfolio(),
  component: LandingPreview,
});

function LandingPreview() {
  const portfolio = Route.useLoaderData();
  return <Landing forcePublic portfolio={portfolio} />;
}
