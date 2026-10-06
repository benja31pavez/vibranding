/**
 * Datos de la ficha del cliente (vista que el cliente también puede ver):
 * avance del ciclo mensual del Plan, campañas activas y su landing. Nada de
 * MRR, salud ni notas internas.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cycleMarkerLike } from "@/lib/delivery/monthPlan";
import { fichaKeys, useUserKey } from "../fichaQueries";

/** Tope por consulta: el ciclo de un mes tiene ~12 tareas. */
const CYCLE_LIMIT = 100;
/** `[plantilla:<etapa>:<clave>:<AAAA-MM>]` → clave. */
const CYCLE_KEY_RE = /\[plantilla:[a-z]+:([a-z0-9-]+):\d{4}-\d{2}\]/;

export interface CycleProgress {
  done: number;
  total: number;
  /** Estado por clave de tarea del ciclo ("calendario", "aprobacion", "reporte"…). */
  doneKeys: ReadonlySet<string>;
  keys: ReadonlySet<string>;
}

/** Tareas del ciclo mensual del Plan para el mes ("AAAA-MM"): cuántas están listas. */
export function useCycleProgress(clientId: string, month: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: [...fichaKeys.all(userKey, clientId), "cycle", month] as const,
    queryFn: async (): Promise<CycleProgress> => {
      const { data, error } = await supabase
        .from("client_tasks")
        .select("status,description")
        .eq("client_id", clientId)
        .like("description", cycleMarkerLike(month))
        .limit(CYCLE_LIMIT);
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map((t) => ({
        key: CYCLE_KEY_RE.exec(t.description ?? "")?.[1] ?? null,
        done: t.status === "done",
      }));
      return {
        done: rows.filter((r) => r.done).length,
        total: rows.length,
        doneKeys: new Set(rows.flatMap((r) => (r.done && r.key ? [r.key] : []))),
        keys: new Set(rows.flatMap((r) => (r.key ? [r.key] : []))),
      };
    },
  });
}

/** Campañas de Meta activas del cliente. */
export function useActiveCampaignCount(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: [...fichaKeys.all(userKey, clientId), "active-campaigns"] as const,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("meta_ads_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "ACTIVE");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

export interface ClientLanding {
  slug: string;
  published: boolean;
  themeColor: string | null;
}

/** Landing del cliente (null si no tiene). */
export function useClientLanding(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: [...fichaKeys.all(userKey, clientId), "landing"] as const,
    queryFn: async (): Promise<ClientLanding | null> => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("slug,published,theme_color")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? { slug: data.slug, published: data.published, themeColor: data.theme_color }
        : null;
    },
  });
}
