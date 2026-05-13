import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "./index";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Vibranding — Landing (preview)" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Landing forcePublic />,
});
