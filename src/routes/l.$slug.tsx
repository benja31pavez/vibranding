import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PublicMultilinkView } from "@/components/multilink/PublicMultilinkView";
import type { Multilink, MultilinkItem } from "@/lib/multilink";

export const Route = createFileRoute("/l/$slug")({
  loader: async ({ params }) => {
    const { data: ml } = await supabase
      .from("multilinks")
      .select("*")
      .eq("slug", params.slug)
      .eq("published", true)
      .maybeSingle();
    if (!ml) throw notFound();
    const { data: items } = await supabase
      .from("multilink_items")
      .select("*")
      .eq("multilink_id", ml.id)
      .eq("is_active", true)
      .order("sort_order");
    return { ml: ml as unknown as Multilink, items: (items ?? []) as unknown as MultilinkItem[] };
  },
  head: ({ loaderData }) => ({
    links: loaderData
      ? [{ rel: "stylesheet", href: fontHref(fontKey(loaderData.ml.font_family)) }]
      : [],
    meta: loaderData
      ? [
          { title: `${loaderData.ml.title} — Enlaces` },
          {
            name: "description",
            content: loaderData.ml.bio ?? `Todos los enlaces de ${loaderData.ml.title}`,
          },
          { property: "og:title", content: loaderData.ml.title },
          { property: "og:description", content: loaderData.ml.bio ?? "" },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
          ...(loaderData.ml.avatar_url
            ? [
                { property: "og:image", content: loaderData.ml.avatar_url },
                { name: "twitter:image", content: loaderData.ml.avatar_url },
              ]
            : []),
        ]
      : [{ title: "Enlaces no disponibles" }, { name: "robots", content: "noindex" }],
  }),
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
        <p className="text-muted-foreground mt-2">Este multienlace no existe o no está publicado.</p>
      </div>
    </div>
  ),
  component: PublicMultilinkRoute,
});

function PublicMultilinkRoute() {
  const { ml, items } = Route.useLoaderData();
  return <PublicMultilinkView ml={ml} items={items} />;
}
