import { supabase } from "@/integrations/supabase/client";
import { isPlaceholderName } from "@/lib/site";

export type PortfolioClient = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  industry: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type PortfolioWork = {
  id: string;
  portfolio_client_id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type PortfolioClientWithWorks = PortfolioClient & { works: PortfolioWork[] };

/**
 * Loads the visible portfolio (clients + works). Used by the "/" route loader so
 * logos and names are part of the server-rendered HTML.
 * Never throws: on failure it logs and returns an empty list (the section hides).
 */
export async function fetchPublicPortfolio(): Promise<PortfolioClientWithWorks[]> {
  try {
    const [clientsRes, worksRes] = await Promise.all([
      supabase
        .from("portfolio_clients")
        .select("id,name,logo_url,description,website_url,industry,sort_order,is_visible")
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("portfolio_works")
        .select("id,portfolio_client_id,title,description,image_url,link_url,sort_order,is_visible")
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    if (clientsRes.error) throw clientsRes.error;
    if (worksRes.error) throw worksRes.error;
    const clients = (clientsRes.data as PortfolioClient[]) ?? [];
    const works = (worksRes.data as PortfolioWork[]) ?? [];
    // Placeholders ("Marca 2", etc.) never leave the server, not even in the dehydrated loader data.
    return clients
      .filter((c) => !isPlaceholderName(c.name))
      .map((c) => ({
        ...c,
        works: works.filter((w) => w.portfolio_client_id === c.id),
      }));
  } catch (err) {
    console.error("[portfolio] could not load public portfolio", err);
    return [];
  }
}
