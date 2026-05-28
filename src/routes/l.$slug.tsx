import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/l/$slug")({
  loader: async ({ params }) => {
    const { data: ml } = await supabase
      .from("multilinks").select("*").eq("slug", params.slug).eq("published", true).maybeSingle();
    if (!ml) throw notFound();
    const { data: items } = await supabase
      .from("multilink_items").select("*")
      .eq("multilink_id", ml.id).eq("is_active", true).order("sort_order");
    return { ml, items: items ?? [] };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.ml.title} — Enlaces` },
      { name: "description", content: loaderData.ml.bio ?? `Enlaces de ${loaderData.ml.title}` },
      { property: "og:title", content: loaderData.ml.title },
      { property: "og:description", content: loaderData.ml.bio ?? "" },
      ...(loaderData.ml.avatar_url ? [{ property: "og:image", content: loaderData.ml.avatar_url }] : []),
    ] : [],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <h1 className="text-3xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground mt-2">Este multienlace no existe o no está publicado.</p>
      </div>
    </div>
  ),
  component: PublicMultilink,
});

function PublicMultilink() {
  const { ml, items } = Route.useLoaderData();

  useEffect(() => {
    supabase.rpc("increment_multilink_view", { _id: ml.id });
  }, [ml.id]);

  const onClick = (id: string) => {
    supabase.rpc("increment_multilink_click", { _id: id });
  };

  const isDark = ml.theme_mode === "dark";

  return (
    <div className="min-h-screen px-4 py-12"
      style={{ background: isDark ? "#0a0a0a" : "#fafafa", color: isDark ? "#fafafa" : "#0a0a0a" }}>
      <div className="max-w-md mx-auto text-center">
        <div className="w-24 h-24 rounded-full mx-auto bg-black/10 overflow-hidden grid place-items-center text-3xl font-semibold">
          {ml.avatar_url
            ? <img src={ml.avatar_url} alt={ml.title} className="w-full h-full object-cover" />
            : (ml.title[0] || "?")}
        </div>
        <h1 className="mt-4 text-2xl font-semibold">{ml.title}</h1>
        {ml.bio && <p className="mt-2 opacity-80 whitespace-pre-line">{ml.bio}</p>}

        <div className="mt-8 space-y-3">
          {items.map(i => (
            <a key={i.id} href={i.url} target="_blank" rel="noreferrer noopener"
              onClick={() => onClick(i.id)}
              className="block rounded-xl py-4 px-5 font-medium transition hover:scale-[1.02]"
              style={{ background: ml.theme_color, color: "#fff" }}>
              {i.title}
            </a>
          ))}
          {items.length === 0 && <p className="opacity-60 text-sm">Sin enlaces todavía.</p>}
        </div>
      </div>
    </div>
  );
}
