import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "./index";
import { fetchPublicPortfolio } from "@/lib/portfolio";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Vibranding — Landing (preview)" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: () => fetchPublicPortfolio(),
  component: LandingPreview,
});

function LandingPreview() {
  const portfolio = Route.useLoaderData();
  return <Landing forcePublic portfolio={portfolio} />;
}
