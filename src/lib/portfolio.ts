import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function usePublicPortfolio() {
  const [data, setData] = useState<PortfolioClientWithWorks[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: clients }, { data: works }] = await Promise.all([
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
      if (cancelled) return;
      const grouped: PortfolioClientWithWorks[] = ((clients as PortfolioClient[]) ?? []).map((c) => ({
        ...c,
        works: ((works as PortfolioWork[]) ?? []).filter((w) => w.portfolio_client_id === c.id),
      }));
      setData(grouped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
