/**
 * Lectura de datos para la página Estadísticas (cliente, con RLS del usuario).
 * Se pide `*` a propósito: si la migración 20261012001000 aún no está
 * aplicada, las columnas nuevas simplemente no vienen y la agregación usa
 * los respaldos (session_id → evento suelto, referrer → dominio).
 */
import { supabase } from "@/integrations/supabase/client";
import { DIAGNOSTICO_SOURCE } from "@/lib/leads/diagnostico.schema";
import type { RawSiteEvent } from "./aggregate";
import { fetchSinceIso } from "./time";

const PAGE_SIZE = 1000;
/** Tope de filas por consulta; si se alcanza la página lo avisa. */
export const MAX_ROWS = 30_000;

export interface SiteEventsResult {
  rows: RawSiteEvent[];
  truncated: boolean;
}

export async function loadSiteEvents(days: number, now = new Date()): Promise<SiteEventsResult> {
  const since = fetchSinceIso(days, now);
  const rows: RawSiteEvent[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("landing_events")
      .select("*")
      .eq("source_type", "site")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as RawSiteEvent[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** Prospectos creados por el formulario de diagnóstico en el rango (RLS: la org del usuario). */
export async function loadDiagnosticoProspects(days: number, now = new Date()): Promise<string[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("created_at")
    .eq("fuente", DIAGNOSTICO_SOURCE)
    .gte("created_at", fetchSinceIso(days, now))
    .limit(MAX_ROWS);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.created_at);
}

/** Fecha del primer evento del sitio registrado ("datos desde"). */
export async function loadFirstEventAt(): Promise<string | null> {
  const { data, error } = await supabase
    .from("landing_events")
    .select("created_at")
    .eq("source_type", "site")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.created_at ?? null;
}
