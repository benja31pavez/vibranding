/** Carga y metadatos compartidos por /l/$slug y la URL antigua /@slug/links. */
import { notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Multilink, MultilinkItem } from "@/lib/multilink";
import { fontHref, fontKey } from "@/lib/multilinkTheme";
import { SITE_URL } from "@/lib/site";
import { NOINDEX_META } from "@/lib/site/robots";
import { safeImageSrc } from "@/lib/site/safeUrl";
import { MULTILINK_ITEM_PUBLIC_COLUMNS, MULTILINK_PUBLIC_COLUMNS } from "@/lib/site/publicColumns";

export type PublicMultilinkData = { ml: Multilink; items: MultilinkItem[] };

export async function loadPublicMultilink(slug: string): Promise<PublicMultilinkData> {
  const { data: ml, error } = await supabase
    .from("multilinks")
    .select(MULTILINK_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ml) throw notFound();
  const { data: items, error: itemsError } = await supabase
    .from("multilink_items")
    .select(MULTILINK_ITEM_PUBLIC_COLUMNS)
    .eq("multilink_id", ml.id)
    .eq("is_active", true)
    .order("sort_order");
  if (itemsError) throw new Error(itemsError.message);
  // Sólo columnas públicas: los campos internos del tipo quedan vacíos a propósito.
  return {
    ml: ml as unknown as Multilink,
    items: (items ?? []) as unknown as MultilinkItem[],
  };
}

export function publicMultilinkHead(data: PublicMultilinkData | undefined) {
  if (!data) {
    return { meta: [{ title: "Página no encontrada" }, NOINDEX_META] };
  }
  const { ml } = data;
  const title = `${ml.title} | Enlaces`;
  const description = ml.bio?.trim() || `Todos los enlaces de ${ml.title}: WhatsApp, redes y más.`;
  const url = `${SITE_URL}/l/${ml.slug}`;
  const image = safeImageSrc(ml.avatar_url);
  return {
    links: [
      { rel: "canonical", href: url },
      { rel: "stylesheet", href: fontHref(fontKey(ml.font_family)) },
    ],
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: ml.title },
      { property: "og:locale", content: "es_CL" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(image
        ? [
            { property: "og:image", content: image },
            { name: "twitter:image", content: image },
          ]
        : []),
    ],
  };
}
