import { supabase } from "@/integrations/supabase/client";

export type GridVersion = {
  id: string;
  client_id: string;
  label: string;
  captured_at: string;
  source: "manual" | "sync";
  is_baseline: boolean;
  notes: string | null;
  followers: number | null;
  following: number | null;
};

/** Marker used for the temporary label of a version being synced. */
export const STAGING_MARKER = "· sincronizando";

/** Staging labels are internal bookkeeping and never shown to the user. */
export const isStagingVersion = (v: { label: string }) =>
  v.label.includes(STAGING_MARKER);

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "Agosto 2026" — default label for a captured version. */
export function monthLabel(d: Date = new Date()) {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatCaptured(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Newest first; the baseline always sits at the bottom of the list. */
export async function loadGridVersions(clientId: string): Promise<GridVersion[]> {
  const { data } = await (supabase.from("instagram_grid_versions" as any) as any)
    .select("*")
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false });
  const rows = ((data ?? []) as GridVersion[]).filter((v) => !isStagingVersion(v));
  return [
    ...rows.filter((v) => !v.is_baseline),
    ...rows.filter((v) => v.is_baseline),
  ];
}

export async function createManualVersion(clientId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Ponle una etiqueta a la versión");
  const { data, error } = await (supabase.from("instagram_grid_versions" as any) as any)
    .insert({
      client_id: clientId,
      label: trimmed,
      source: "manual",
      captured_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      throw new Error(`Ya existe una versión llamada "${trimmed}" para este cliente`);
    }
    throw new Error(error.message);
  }
  return data as GridVersion;
}

export async function updateVersionMeta(
  id: string,
  patch: { label?: string; notes?: string | null },
) {
  const body: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    const trimmed = patch.label.trim();
    if (!trimmed) throw new Error("La etiqueta no puede quedar vacía");
    body.label = trimmed;
  }
  if (patch.notes !== undefined) body.notes = patch.notes;
  const { error } = await (supabase.from("instagram_grid_versions" as any) as any)
    .update(body)
    .eq("id", id);
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      throw new Error("Ya existe otra versión con esa etiqueta");
    }
    throw new Error(error.message);
  }
}
