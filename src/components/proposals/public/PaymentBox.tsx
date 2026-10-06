import { useState, type ReactNode } from "react";
import { CheckCircle2, CreditCard, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startProposalPayment } from "@/lib/proposals/public.functions";
import type { PublicPaymentState } from "@/lib/proposals/public.server";

/** Siguiente paso tras aceptar: pagar con Flow o, si aún no está listo, te contactamos. */
export function PaymentBox({ token, payment }: { token: string; payment: PublicPaymentState }) {
  switch (payment.state) {
    case "none":
      return null;
    case "paid":
      return (
        <Notice icon={CheckCircle2} title="Pago recibido">
          Ya registramos tu pago. ¡Gracias!
        </Notice>
      );
    case "contact":
      return (
        <Notice icon={Mail} title="Te contactaremos para el pago">
          Recibimos tu aceptación. En las próximas horas hábiles te escribimos para coordinar el
          pago y el inicio.
        </Notice>
      );
    case "transfer":
      return (
        <Notice icon={Mail} title="Próximo paso: el pago">
          Te contactaremos para coordinar el pago.
        </Notice>
      );
    case "flow":
      return <FlowPay token={token} initialUrl={payment.paymentUrl} />;
  }
}

function FlowPay({ token, initialUrl }: { token: string; initialUrl: string | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const pay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await startProposalPayment({ data: { token, email: email.trim() } });
      if (res.state === "link") {
        window.location.assign(res.paymentUrl);
        return;
      }
      if (res.state === "already_paid") setPaid(true);
      else setMessage(res.message);
    } catch (err) {
      console.error("[proposal] pagar falló", err);
      setMessage("No pudimos abrir el pago. Intenta de nuevo o escríbenos.");
    } finally {
      setBusy(false);
    }
  };

  if (paid) {
    return (
      <Notice icon={CheckCircle2} title="Pago recibido">
        Ya registramos tu pago. ¡Gracias!
      </Notice>
    );
  }

  return (
    <Notice icon={CreditCard} title="Paga en línea con Flow">
      <p>Puedes pagar ahora con tarjeta o transferencia a través de Flow. No hay devoluciones.</p>
      {!initialUrl && (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="pay-email">Email para el comprobante</Label>
          <Input
            id="pay-email"
            type="email"
            autoComplete="email"
            value={email}
            maxLength={200}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      )}
      {message && (
        <p role="alert" className="mt-3 text-sm text-danger-strong">
          {message}
        </p>
      )}
      <Button size="lg" className="mt-4 w-full" onClick={pay} disabled={busy}>
        {busy && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
        Pagar ahora
      </Button>
    </Notice>
  );
}

function Notice({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs">
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-1 text-sm text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}
