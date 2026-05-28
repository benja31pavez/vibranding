import { supabase } from "@/integrations/supabase/client";

export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);
}

/** Find a unique slug in the given table by appending -2, -3, ... */
export async function uniqueSlug(
  table: "multilinks" | "landing_pages",
  base: string,
): Promise<string> {
  const seed = slugify(base) || "pagina";
  let candidate = seed;
  for (let i = 2; i < 100; i++) {
    const { data } = await supabase
      .from(table)
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${seed}-${i}`;
  }
  return `${seed}-${Date.now()}`;
}
