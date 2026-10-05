import { PartyPopper, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/app";
import { pendingCount, type PortalApprovals, type SectionResult } from "@/lib/portal/model";
import { DeliverableApprovalCard, PostApprovalCard } from "./ApprovalCards";
import { PortalSection, SectionState } from "./PortalSection";
import { usePortalDecision, type PortalMode } from "./usePortal";

interface ApprovalsSectionProps {
  mode: PortalMode;
  loading: boolean;
  result: SectionResult<PortalApprovals> | undefined;
  onRetry: () => void;
  retrying: boolean;
}

/** "Esto necesita tu OK": lo primero que ve el cliente. */
export function ApprovalsSection({
  mode,
  loading,
  result,
  onRetry,
  retrying,
}: ApprovalsSectionProps) {
  const decision = usePortalDecision(mode);
  const readOnly = mode.kind === "preview";
  const count = pendingCount(result);
  const busyId = decision.isPending ? decision.variables?.id : undefined;

  return (
    <PortalSection
      id="pendientes"
      title="Esto necesita tu OK"
      icon={Sparkles}
      tone={count > 0 ? "warning" : "default"}
      description={
        count > 0
          ? `${count === 1 ? "Hay 1 cosa" : `Hay ${count} cosas`} esperando tu respuesta. Te toma un minuto.`
          : undefined
      }
    >
      <SectionState
        loading={loading}
        result={result}
        onRetry={onRetry}
        retrying={retrying}
        skeletonRows={2}
      >
        {(data) =>
          data.deliverables.length + data.posts.length === 0 ? (
            <EmptyState
              size="compact"
              icon={PartyPopper}
              title="¡Estás al día!"
              description="No tienes nada pendiente por revisar. Te avisaremos cuando haya algo nuevo."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.deliverables.map((d) => (
                <DeliverableApprovalCard
                  key={d.id}
                  deliverable={d}
                  readOnly={readOnly}
                  busy={busyId === d.id}
                  onDecide={(choice, note) =>
                    decision.mutate({ kind: "deliverable", id: d.id, decision: choice, note })
                  }
                />
              ))}
              {data.posts.map((p) => (
                <PostApprovalCard
                  key={p.id}
                  post={p}
                  readOnly={readOnly}
                  busy={busyId === p.id}
                  onDecide={(choice, note) =>
                    decision.mutate({ kind: "post", id: p.id, decision: choice, note })
                  }
                />
              ))}
            </div>
          )
        }
      </SectionState>
    </PortalSection>
  );
}
