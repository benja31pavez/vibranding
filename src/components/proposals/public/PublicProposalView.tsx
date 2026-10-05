import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { CheckCircle2, CircleSlash, Clock3, ShieldCheck } from "lucide-react";
import { findPlan } from "@/lib/pricing/plans";
import {
  computeTotals,
  formatChileDate,
  hasMonthlyBilling,
  proposalConditions,
} from "@/lib/proposals/model";
import type {
  AcceptResult,
  PublicPaymentState,
  PublicProposal,
} from "@/lib/proposals/public.server";
import { cn } from "@/lib/utils";
import { ProposalLines } from "../ProposalLines";
import { AcceptProposalForm } from "./AcceptProposalForm";
import { PaymentBox } from "./PaymentBox";
import { first30Days, planFeatures, proposalFaq, proposalOutcome } from "./proposalContent";
import {
  ACCEPT_ANCHOR,
  Card,
  ContactCard,
  Faq,
  FeatureList,
  ProcessSteps,
  ProposalHero,
  StickyAcceptBar,
  Timeline,
  ValidityNote,
} from "./ProposalSections";

interface Props {
  token: string;
  proposal: PublicProposal;
  payment: PublicPaymentState | null;
}

export function PublicShell({
  children,
  stickyBar,
}: {
  children: ReactNode;
  stickyBar?: ReactNode;
}) {
  return (
    <div className={cn("min-h-screen bg-bg", stickyBar && "pb-24 sm:pb-0")}>
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand-strong">
            Vibranding
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        VIBRANDING SpA · Santiago de Chile
      </footer>
      {stickyBar}
    </div>
  );
}

/** Propuesta pública: resultado, qué incluye, primeros 30 días, proceso, FAQ y aceptación. */
export function PublicProposalView({ token, proposal, payment }: Props) {
  const router = useRouter();
  const [accepted, setAccepted] = useState<Extract<AcceptResult, { ok: true }> | null>(null);
  const plan = findPlan(proposal.planKey);
  const planKey = plan?.key ?? null;
  const totals = computeTotals(proposal.items);
  const hasMonthly = hasMonthlyBilling(proposal.planKey, proposal.items);
  const conditions = proposalConditions(proposal.planKey, proposal.items);
  const status = accepted ? "aceptada" : proposal.status;
  const open = status === "enviada" || status === "vista";
  const paymentState = accepted?.payment ?? payment;

  const onAccepted = (res: Extract<AcceptResult, { ok: true }>) => {
    setAccepted(res);
    void router.invalidate();
  };

  return (
    <PublicShell stickyBar={open ? <StickyAcceptBar totals={totals} /> : undefined}>
      <StatusNotice status={status} proposal={proposal} justAccepted={Boolean(accepted)} />

      {status === "aceptada" && paymentState && <PaymentBox token={token} payment={paymentState} />}

      <ProposalHero
        recipientName={proposal.recipientName}
        title={proposal.title}
        planLabel={plan?.label ?? null}
        outcome={proposalOutcome(planKey)}
        totals={totals}
        expiresAt={open ? proposal.expiresAt : null}
        open={open}
      />

      <Card title={hasMonthly ? "Qué incluye cada mes" : "Qué incluye"}>
        <FeatureList features={planFeatures(planKey)} />
        <ProposalLines items={proposal.items} />
      </Card>

      {open && (
        <Card title="Tus primeros 30 días">
          <Timeline steps={first30Days(planKey)} />
        </Card>
      )}

      {open && (
        <Card title="Cómo seguimos">
          <ProcessSteps />
        </Card>
      )}

      <Card title="Condiciones">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {conditions.map((c) => (
            <li key={c} className="flex gap-2">
              <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Preguntas frecuentes">
        <Faq items={proposalFaq(planKey, hasMonthly, plan?.minMonths ?? 3)} />
      </Card>

      {open && (
        <Card title="Aceptar la propuesta" id={ACCEPT_ANCHOR}>
          <div className="mb-4">
            <ValidityNote expiresAt={proposal.expiresAt} />
          </div>
          <AcceptProposalForm token={token} onAccepted={onAccepted} />
        </Card>
      )}

      <ContactCard title={proposal.title} open={open} />
    </PublicShell>
  );
}

function StatusNotice({
  status,
  proposal,
  justAccepted,
}: {
  status: string;
  proposal: PublicProposal;
  justAccepted: boolean;
}) {
  if (status === "aceptada") {
    const when = proposal.acceptedAt ? ` el ${formatChileDate(proposal.acceptedAt)}` : "";
    const who = proposal.acceptedName ? ` por ${proposal.acceptedName}` : "";
    return (
      <Banner tone="success" icon={CheckCircle2}>
        {justAccepted
          ? "¡Listo! Propuesta aceptada. Gracias por confiar en nosotros."
          : `Propuesta aceptada${who}${when}.`}
      </Banner>
    );
  }
  if (status === "expirada") {
    return (
      <Banner tone="warning" icon={Clock3}>
        Esta propuesta venció. Escríbenos y te enviamos una actualizada.
      </Banner>
    );
  }
  if (status === "rechazada") {
    return (
      <Banner tone="neutral" icon={CircleSlash}>
        Esta propuesta fue cerrada. Si quieres retomarla, escríbenos.
      </Banner>
    );
  }
  return null;
}

const BANNER_TONE = {
  success: "bg-success-subtle text-success-strong",
  warning: "bg-warning-subtle text-warning-strong",
  neutral: "bg-neutral-subtle text-neutral-strong",
} as const;

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: keyof typeof BANNER_TONE;
  icon: typeof CheckCircle2;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-app-lg px-4 py-3 text-sm font-medium ${BANNER_TONE[tone]}`}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
