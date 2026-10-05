import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProposalEditorPage } from "@/components/proposals/ProposalEditorPage";

const Search = z.object({
  clientId: z.string().uuid().optional(),
  prospectId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_app/proposals/new")({
  validateSearch: (search: Record<string, unknown>) => {
    const parsed = Search.safeParse(search);
    return parsed.success ? parsed.data : {};
  },
  head: () => ({
    meta: [
      { title: "Nueva propuesta · Vibranding" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NewProposalPage,
});

function NewProposalPage() {
  const { clientId, prospectId } = Route.useSearch();
  // Si vienen ambos, manda el cliente (la propuesta se cobra a un cliente).
  return <ProposalEditorPage target={clientId ? { clientId } : { prospectId }} />;
}
