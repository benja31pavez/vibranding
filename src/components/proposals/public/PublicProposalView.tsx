import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, CircleSlash, Clock3, ShieldCheck } from "lucide-react";
import { findPlan, planPriceLabel } from "@/lib/pricing/plans";
import { formatChileDate, proposalConditions } from "@/lib/proposals/model";
import type { AcceptResult, PublicPaymentState, PublicProposal } from "@/lib/proposals/public.server";
import { ProposalLines } from "../ProposalLines";
import { AcceptProposalForm } from "./AcceptProposalForm";
import { PaymentBox } from "./PaymentBox";

interface Props {
  token: string;
  proposal: PublicProposal;
  payment: PublicPaymentState | null;
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand-strong">Vibranding</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        VIBRANDING SpA · Santiago de Chile
      </footer>
    </div>
  );
}

/** Propuesta pública: detalle, condiciones y aceptación (o su estado final). */
export function PublicProposalView({ token, proposal, payment }: Props) {
  const router = useRouter();
  const [accepted, setAccepted] = useState<Extract<AcceptResult, { ok: true }> | null>(null);
  const plan = findPlan(proposal.planKey);
  const conditions = proposalConditions(proposal.planKey, proposal.items);
  const status = accepted ? "aceptada" : proposal.status;
  const open = status === "enviada" || status === "vista";
  const paymentState = accepted?.payment ?? payment;

  const onAccepted = (res: Extract<AcceptResult, { ok: true }>) => {
    setAccepted(res);
    void router.invalidate();
  };

  return (
    <PublicShell>
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Propuesta para <span className="font-medium text-foreground">{proposal.recipientName ?? "ti"}</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {proposal.title ?? "Propuesta Vibranding"}
        </h1>
        {plan && (
          <p className="text-sm text-muted-foreground">
            {plan.label} · {planPriceLabel(plan)}
          </p>
        )}
      </section>

      <StatusNotice status={status} proposal={proposal} justAccepted={Boolean(accepted)} />

      {status === "aceptada" && paymentState && <PaymentBox token={token} payment={paymentState} />}

      <Card title="Qué incluye">
        {plan && <p className="mb-2 text-sm text-muted-foreground">{plan.description}</p>}
        <ProposalLines items={proposal.items} />
      </Card>

      <Card title="Condiciones">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {conditions.map((c) => (
            <li key={c} className="flex gap-2">
              <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        {proposal.expiresAt && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock aria-hidden className="h-4 w-4" />
            Válida hasta el {formatChileDate(proposal.expiresAt)}.
          </p>
        )}
      </Card>

      {open && (
        <Card title="Aceptar la propuesta">
          <AcceptProposalForm token={token} onAccepted={onAccepted} />
        </Card>
      )}
    </PublicShell>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs sm:p-6">
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
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
        {justAccepted ? "¡Listo! Propuesta aceptada. Gracias por confiar en nosotros." : `Propuesta aceptada${who}${when}.`}
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
    <div role="status" className={`flex items-start gap-3 rounded-app-lg px-4 py-3 text-sm font-medium ${BANNER_TONE[tone]}`}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
