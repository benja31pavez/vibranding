import { createFileRoute } from "@tanstack/react-router";
import { getPublicProposal } from "@/lib/proposals/public.functions";
import { PublicProposalView, PublicShell } from "@/components/proposals/public/PublicProposalView";

/**
 * Propuesta pública por token (SSR). Meta genéricas a propósito: los bots de
 * vista previa (WhatsApp, Slack…) no deben mostrar montos ni nombres.
 * El "visto" lo marca el servidor solo si no es un bot (ver viewTracking.ts).
 */
export const Route = createFileRoute("/p/$token")({
  validateSearch: (search: Record<string, unknown>): { vista?: string } =>
    typeof search.vista === "string" ? { vista: search.vista.slice(0, 20) } : {},
  loaderDeps: ({ search }) => ({ vista: search.vista }),
  loader: ({ params, deps }) => getPublicProposal({ data: { token: params.token, vista: deps.vista } }),
  head: () => ({
    meta: [
      { title: "Propuesta · VIBRANDING" },
      { name: "description", content: "Revisa y acepta tu propuesta de Vibranding." },
      { property: "og:title", content: "Propuesta · VIBRANDING" },
      { property: "og:description", content: "Revisa y acepta tu propuesta de Vibranding." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      // El token va en la URL: no se envía como Referer al salir (p. ej. a Flow).
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  errorComponent: () => (
    <PublicShell>
      <div role="alert" className="rounded-app-lg border border-border-subtle bg-surface p-6 text-sm text-muted-foreground">
        No pudimos cargar la propuesta. Vuelve a intentarlo en unos minutos.
      </div>
    </PublicShell>
  ),
  component: PublicProposalRoute,
});

function PublicProposalRoute() {
  const { token } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.ok) {
    return (
      <PublicShell>
        <div className="rounded-app-lg border border-border-subtle bg-surface p-6">
          <h1 className="text-xl font-semibold text-foreground">Este link no es válido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Puede que esté incompleto o que la propuesta ya no esté disponible. Pide uno nuevo a tu contacto en
            Vibranding.
          </p>
        </div>
      </PublicShell>
    );
  }
  return <PublicProposalView token={token} proposal={data.proposal} payment={data.payment} />;
}
