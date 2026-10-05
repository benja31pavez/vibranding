import { createFileRoute, Link } from "@tanstack/react-router";
import { MARKETING_META, MARKETING_ORG_SCRIPT } from "@/lib/marketingSeo";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { DiagnosticoAside, DiagnosticoIncludes } from "@/components/diagnostico/DiagnosticoAside";
import { DiagnosticoForm } from "@/components/diagnostico/DiagnosticoForm";
import { DiagnosticoThanks } from "@/components/diagnostico/DiagnosticoThanks";
import { PLAN_INTERESTS, type PlanInterest } from "@/lib/leads/diagnostico.schema";
import { ORGANIZATION_ID, SITE_URL } from "@/lib/site";

const TITLE = "Diagnóstico gratis de tu marca | Vibranding";
const DESCRIPTION =
  "Cuéntanos de tu pyme en 1 minuto y te enviamos un diagnóstico gratis de tu marca, tus redes y tu presencia en Google, con qué haríamos primero.";
const URL = `${SITE_URL}/diagnostico`;

type Search = { plan?: PlanInterest };

export const Route = createFileRoute("/diagnostico")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    plan: (PLAN_INTERESTS as readonly unknown[]).includes(s["plan"])
      ? (s["plan"] as PlanInterest)
      : undefined,
  }),
  head: () => ({
    meta: [
      ...MARKETING_META,
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:locale", content: "es_CL" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      MARKETING_ORG_SCRIPT,
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Diagnóstico gratis de marca",
          serviceType: "Diagnóstico de marketing digital",
          url: URL,
          areaServed: { "@type": "Country", name: "Chile" },
          provider: { "@id": ORGANIZATION_ID },
          offers: { "@type": "Offer", price: "0", priceCurrency: "CLP" },
        }),
      },
    ],
  }),
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  const { plan } = Route.useSearch();
  const [doneFor, setDoneFor] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-10">
          <Link to="/" aria-label="Vibranding, inicio">
            <span className="font-brand text-2xl tracking-tight text-gradient-brand-strong md:text-3xl">
              Vibranding
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" /> Volver al inicio
          </Link>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:px-10 md:py-16">
        {doneFor ? (
          <div className="mx-auto max-w-2xl">
            <DiagnosticoThanks negocio={doneFor} />
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8">
            <div className="lg:col-span-5">
              <p className="text-sm font-semibold uppercase tracking-widest text-[color:color-mix(in_oklab,var(--brand-2)_70%,black)] dark:text-[color:var(--brand-2)]">
                Gratis · sin compromiso
              </p>
              <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-tight text-balance md:text-5xl">
                Diagnóstico gratis{" "}
                <span className="font-brand text-gradient-brand-strong">de tu marca</span>
              </h1>
              <p className="mt-4 text-base text-muted-foreground text-pretty md:text-lg">
                Cuéntanos de tu negocio en 1 minuto. Revisamos cómo te ve hoy un cliente en internet
                y te escribimos con lo que haríamos primero.
              </p>
              <div className="mt-8">
                <DiagnosticoIncludes />
              </div>
            </div>
            <div className="relative rounded-3xl border bg-card p-5 shadow-sm md:p-8 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
              <DiagnosticoForm plan={plan} onDone={setDoneFor} />
            </div>
            <aside className="lg:col-span-5 lg:col-start-1 lg:row-start-2">
              <div className="lg:[@media(min-height:700px)]:sticky lg:top-8">
                <DiagnosticoAside />
              </div>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
