import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app";
import { ProposalEditorPage } from "@/components/proposals/ProposalEditorPage";
import { useProposal } from "@/components/proposals/proposalQueries";

/** Editor de una propuesta existente. Es el destino de `approval_queue.url_hint`. */
export const Route = createFileRoute("/_app/proposals/$proposalId")({
  head: () => ({
    meta: [{ title: "Propuesta · Vibranding" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ProposalPage,
});

function ProposalPage() {
  const { proposalId } = Route.useParams();
  const query = useProposal(proposalId);

  if (query.isLoading) return <ListSkeleton rows={6} label="Cargando propuesta" />;
  if (query.error) {
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  }
  const proposal = query.data;
  if (!proposal) {
    return <EmptyState icon={FileText} title="Propuesta no encontrada" description="Puede que se haya borrado o que no tengas acceso." />;
  }
  return (
    <ProposalEditorPage
      target={{ clientId: proposal.client_id, prospectId: proposal.prospect_id }}
      existing={proposal}
    />
  );
}
