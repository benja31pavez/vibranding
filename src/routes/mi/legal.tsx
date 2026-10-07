import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/client-panel/LegalPage";

export const Route = createFileRoute("/mi/legal")({
  head: () => ({ meta: [{ title: "Legal | Vibranding" }] }),
  component: LegalPage,
});
