import { createFileRoute } from "@tanstack/react-router";
import { InstagramPage } from "@/components/client-panel/InstagramPage";

export const Route = createFileRoute("/mi/instagram")({
  head: () => ({ meta: [{ title: "Instagram | Vibranding" }] }),
  component: InstagramPage,
});
