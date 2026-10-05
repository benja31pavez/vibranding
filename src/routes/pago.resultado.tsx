import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/site";

const PAYMENT_HELP_MESSAGE = "Hola, acabo de pagar con Flow y quería confirmar mi pago.";

export const Route = createFileRoute("/pago/resultado")({
  head: () => ({
    meta: [
      { title: "Pago recibido · VIBRANDING" },
      { name: "description", content: "Estamos confirmando tu pago." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PaymentResultPage,
});

function PaymentResultPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-4 py-16">
      <span className="font-brand text-2xl tracking-tight text-gradient-brand-strong">
        Vibranding
      </span>
      <div className="w-full max-w-md space-y-4 rounded-app-lg border border-border-subtle bg-surface p-8 text-center shadow-app-xs">
        <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-success" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          ¡Gracias! Estamos confirmando tu pago
        </h1>
        <p className="text-sm text-muted-foreground">
          Flow nos avisará en unos minutos. Si el pago fue aprobado, recibirás el comprobante en tu
          correo. Puedes cerrar esta ventana.
        </p>
        <p className="text-sm text-muted-foreground">
          ¿Algún problema?{" "}
          <a
            href={whatsappUrl(PAYMENT_HELP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            <MessageCircle aria-hidden className="h-3.5 w-3.5" />
            Escríbenos por WhatsApp
          </a>{" "}
          y lo revisamos.
        </p>
      </div>
    </main>
  );
}
