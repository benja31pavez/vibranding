import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md space-y-4 rounded-app-lg border border-border-subtle bg-surface p-8 text-center shadow-app-xs">
        <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-success" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          ¡Gracias! Estamos confirmando tu pago
        </h1>
        <p className="text-sm text-muted-foreground">
          Flow nos avisará en unos minutos. Si el pago fue aprobado, recibirás el comprobante en tu
          correo. Puedes cerrar esta ventana.
        </p>
        <p className="text-xs text-muted-foreground">¿Algún problema? Escríbenos y lo revisamos.</p>
      </div>
    </main>
  );
}
