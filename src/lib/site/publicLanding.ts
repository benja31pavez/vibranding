/** Carga pública de una landing (/@slug y la vista previa del panel del cliente). */
import { notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LANDING_PUBLIC_COLUMNS } from "@/lib/site/publicColumns";

/** Solo landings publicadas y solo columnas públicas; si no existe, notFound(). */
export async function loadPublicLanding(slug: string) {
  const { data, error } = await supabase
    .from("landing_pages")
    .select(LANDING_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFound();
  return { lp: data };
}

export type PublicLandingData = Awaited<ReturnType<typeof loadPublicLanding>>;
