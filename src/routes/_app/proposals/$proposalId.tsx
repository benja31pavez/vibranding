import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app";
import { ProposalEditorPage, ProposalPageShell } from "@/components/proposals/ProposalEditorPage";
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

  if (query.isLoading) {
    return (
      <ProposalPageShell>
        <ListSkeleton rows={6} label="Cargando propuesta" />
      </ProposalPageShell>
    );
  }
  if (query.error) {
    return (
      <ProposalPageShell>
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </ProposalPageShell>
    );
  }
  const proposal = query.data;
  if (!proposal) {
    return (
      <ProposalPageShell>
        <EmptyState
          icon={FileText}
          title="Propuesta no encontrada"
          description="Puede que se haya borrado o que no tengas acceso."
        />
      </ProposalPageShell>
    );
  }
  return (
    <ProposalEditorPage
      target={{ clientId: proposal.client_id, prospectId: proposal.prospect_id }}
      existing={proposal}
    />
  );
}
