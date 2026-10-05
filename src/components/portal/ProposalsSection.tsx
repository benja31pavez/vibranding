import { ArrowRight, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Money, StatusBadge } from "@/components/app";
import {
  PROPOSAL_STATUS_META,
  effectiveStatus,
  formatChileDate,
  isProposalStatus,
} from "@/lib/proposals/model";
import type { PortalProposal, SectionResult } from "@/lib/portal/model";
import { PortalSection, SectionState } from "./PortalSection";

interface ProposalsSectionProps {
  loading: boolean;
  result: SectionResult<PortalProposal[]> | undefined;
  onRetry: () => void;
  retrying: boolean;
}

const OPEN_STATUSES = new Set(["enviada", "vista"]);

/** Propuestas enviadas al cliente, con enlace a la página pública /p/$token. */
export function ProposalsSection({ loading, result, onRetry, retrying }: ProposalsSectionProps) {
  return (
    <PortalSection id="propuestas" title="Propuestas" icon={FileSignature}>
      <SectionState
        loading={loading}
        result={result}
        onRetry={onRetry}
        retrying={retrying}
        skeletonRows={2}
      >
        {(proposals) =>
          proposals.length === 0 ? (
            <EmptyState
              size="compact"
              icon={FileSignature}
              title="Sin propuestas por ahora"
              description="Cuando te preparemos una propuesta nueva, la podrás revisar y aceptar desde aquí."
            />
          ) : (
            <ul className="space-y-3">
              {proposals.map((p) => (
                <ProposalRow key={p.id} proposal={p} />
              ))}
            </ul>
          )
        }
      </SectionState>
    </PortalSection>
  );
}

function ProposalRow({ proposal }: { proposal: PortalProposal }) {
  const status = effectiveStatus(proposal.status, proposal.expiresAt);
  const meta = isProposalStatus(status) ? PROPOSAL_STATUS_META[status] : undefined;
  const open = OPEN_STATUSES.has(status);
  return (
    <li className="rounded-app-lg border border-border-subtle bg-bg p-4 shadow-app-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{proposal.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {open && proposal.expiresAt
              ? `Válida hasta el ${formatChileDate(proposal.expiresAt)}`
              : proposal.sentAt
                ? `Enviada el ${formatChileDate(proposal.sentAt)}`
                : ""}
          </p>
        </div>
        <StatusBadge status={status} label={meta?.label} tone={meta?.tone} className="shrink-0" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-baseline gap-1.5">
          <Money amount={proposal.amountClp} className="text-2xl font-semibold tracking-tight" />
          <span className="text-xs text-muted-foreground">total con IVA</span>
        </p>
        <Button asChild variant={open ? "default" : "outline"} className="h-11 w-full sm:w-auto">
          <a href={`/p/${encodeURIComponent(proposal.token)}`} target="_blank" rel="noreferrer">
            {open ? "Revisar y aceptar" : "Ver propuesta"}{" "}
            <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
          </a>
        </Button>
      </div>
    </li>
  );
}
