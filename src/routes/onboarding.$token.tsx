import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell } from "@/components/proposals/public/PublicProposalView";
import { OnboardingDone } from "@/components/onboarding/OnboardingDone";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { STEPS } from "@/components/onboarding/formState";
import { getOnboarding } from "@/lib/onboarding/public.functions";
import { formatChileDate } from "@/lib/proposals/model";

/**
 * Formulario público de onboarding por token (SSR). Meta genéricas: los bots
 * de vista previa no deben mostrar el nombre del cliente. Headers privados en
 * src/server.ts (no-store, no-referrer, noindex) y Disallow en robots.txt.
 */
export const Route = createFileRoute("/onboarding/$token")({
  loader: ({ params }) => getOnboarding({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Bienvenida · VIBRANDING" },
      {
        name: "description",
        content: "Completa tus datos para empezar a trabajar con Vibranding.",
      },
      { property: "og:title", content: "Bienvenida · VIBRANDING" },
      {
        property: "og:description",
        content: "Completa tus datos para empezar a trabajar con Vibranding.",
      },
      { name: "twitter:title", content: "Bienvenida · VIBRANDING" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  errorComponent: () => (
    <PublicShell>
      <div
        role="alert"
        className="rounded-app-lg border border-border-subtle bg-surface p-6 text-sm text-muted-foreground"
      >
        No pudimos cargar el formulario. Vuelve a intentarlo en unos minutos.
      </div>
    </PublicShell>
  ),
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const { token } = Route.useParams();
  const data = Route.useLoaderData();
  const [done, setDone] = useState(false);

  if (!data.ok) {
    return (
      <PublicShell>
        <div className="rounded-app-lg border border-border-subtle bg-surface p-6">
          <h1 className="text-xl font-semibold text-foreground">Este link ya no está disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Puede que esté incompleto, que haya vencido o que el formulario ya se haya enviado. Si
            necesitas uno nuevo, pídeselo a tu contacto en Vibranding.
          </p>
        </div>
      </PublicShell>
    );
  }

  if (done) {
    return (
      <PublicShell>
        <OnboardingDone clientName={data.clientName} />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">
          ¡Bienvenido a {data.agencyName ?? "Vibranding"}!
        </p>
        <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          Hola, {data.clientName}. Cuéntanos de tu negocio
        </h1>
        <p className="text-muted-foreground">
          Son {STEPS.length} pasos cortos (unos 10 minutos). Solo la razón social es obligatoria:
          completa lo que tengas a mano y lo demás lo vemos juntos.
        </p>
        {data.expiresAt && (
          <p className="text-xs text-muted-foreground">
            Este link vence el {formatChileDate(data.expiresAt)}.
          </p>
        )}
      </header>
      <OnboardingWizard token={token} onDone={() => setDone(true)} />
    </PublicShell>
  );
}
