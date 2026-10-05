import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/track";
import { PublicLandingView } from "@/components/landing/PublicLandingView";
import { landingCanonicalUrl, landingSeoDescription, landingSeoTitle } from "@/lib/site/landingSeo";

export const Route = createFileRoute("/@{$slug}")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    return { lp: data };
  },
  head: ({ loaderData }) => {
    const lp = loaderData?.lp;
    if (!lp)
      return { meta: [{ title: "Página no encontrada" }, { name: "robots", content: "noindex" }] };
    const title = landingSeoTitle(lp);
    const description = landingSeoDescription(lp);
    const url = landingCanonicalUrl(lp.slug);
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: description },
        { name: "theme-color", content: lp.theme_color || "#6366f1" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: "es_CL" },
        { property: "og:site_name", content: (lp.hero_title || title).trim() },
        { name: "twitter:card", content: lp.hero_image_url ? "summary_large_image" : "summary" },
        ...(lp.hero_image_url
          ? [
              { property: "og:image", content: lp.hero_image_url },
              { property: "og:image:alt", content: title },
              { name: "twitter:image", content: lp.hero_image_url },
            ]
          : []),
      ],
    };
  },
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
        <p className="text-muted-foreground mt-2">Vuelve a intentarlo en unos segundos.</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <h1 className="text-3xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground mt-2">
          Esta página no existe o todavía no está publicada.
        </p>
      </div>
    </div>
  ),
  component: PublicLanding,
});

function PublicLanding() {
  const { lp } = Route.useLoaderData();

  useEffect(() => {
    trackEvent("page_view", { type: "landing", id: lp.id });
  }, [lp.id]);

  return (
    <div className="min-h-screen">
      <PublicLandingView
        lp={lp}
        onCtaClick={() => trackEvent("contact_click", { type: "landing", id: lp.id })}
        onWhatsappClick={() => trackEvent("whatsapp_click", { type: "landing", id: lp.id })}
      />
    </div>
  );
}
