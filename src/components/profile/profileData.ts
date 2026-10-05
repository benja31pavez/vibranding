import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { loadPricing } from "@/components/PricingPanel";

/**
 * Datos de "Editar perfil": perfil del dueño (user_profiles) y datos de la agencia
 * (pricing_settings, la misma fila que usan los contratos).
 *
 * Las columnas nuevas (job_title, agency_business_activity, agency_website,
 * agency_instagram, agency_business_hours) llegan con la migración
 * 20261012001200_perfil_agencia.sql. Mientras no esté aplicada, los campos se
 * muestran deshabilitados y nunca se envían al guardar.
 */

export const profileKeys = {
  owner: (userId: string) => ["profile", "owner", userId] as const,
  agency: (userId: string) => ["profile", "agency", userId] as const,
};

export interface OwnerProfile {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  /** false si la columna job_title aún no existe (migración sin aplicar). */
  hasJobTitle: boolean;
}

export const AGENCY_TEXT_FIELDS = [
  "agency_legal_name",
  "agency_tax_id",
  "agency_address",
  "agency_email",
] as const;

export const AGENCY_EXTENDED_FIELDS = [
  "agency_business_activity",
  "agency_website",
  "agency_instagram",
  "agency_business_hours",
] as const;

type AgencyTextField = (typeof AGENCY_TEXT_FIELDS)[number];
type AgencyExtendedField = (typeof AGENCY_EXTENDED_FIELDS)[number];
export type AgencyField = AgencyTextField | AgencyExtendedField;

export type AgencyValues = Record<AgencyField, string>;

export interface AgencyProfile {
  id: string;
  values: AgencyValues;
  /** false si las columnas nuevas aún no existen (migración sin aplicar). */
  hasExtended: boolean;
}

/** PostgREST: columna inexistente en el esquema (migración pendiente). */
const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);

export function isMissingColumnError(error: { code?: string } | null): boolean {
  return Boolean(error?.code && MISSING_COLUMN_CODES.has(error.code));
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function toOwnerProfile(row: Record<string, unknown> | null): OwnerProfile {
  return {
    full_name: (row?.full_name as string | null) ?? null,
    phone: (row?.phone as string | null) ?? null,
    avatar_url: (row?.avatar_url as string | null) ?? null,
    job_title: (row?.job_title as string | null) ?? null,
    // Sin fila no se sabe: se intenta guardar y, si falla por columna, se reintenta sin ella.
    hasJobTitle: row === null || "job_title" in row,
  };
}

export function toAgencyProfile(row: Record<string, unknown>): AgencyProfile {
  const fields = [...AGENCY_TEXT_FIELDS, ...AGENCY_EXTENDED_FIELDS];
  const values = Object.fromEntries(fields.map((f) => [f, text(row[f])])) as AgencyValues;
  return {
    id: String(row.id),
    values,
    hasExtended: AGENCY_EXTENDED_FIELDS.every((f) => f in row),
  };
}

export function useOwnerProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: profileKeys.owner(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<OwnerProfile> => {
      // "*" para tolerar columnas aún no creadas.
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("[profile] error al cargar el perfil", error);
        throw new Error("No pudimos cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.");
      }
      return toOwnerProfile(data as Record<string, unknown> | null);
    },
  });
}

export function useAgencyProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: profileKeys.agency(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<AgencyProfile> => {
      try {
        const row = await loadPricing(userId);
        if (!row) throw new Error("Sin datos de agencia");
        return toAgencyProfile(row as unknown as Record<string, unknown>);
      } catch (err) {
        console.error("[profile] error al cargar los datos de la agencia", err);
        throw new Error("No pudimos cargar los datos de la agencia. Inténtalo de nuevo.");
      }
    },
  });
}

export interface OwnerDraft {
  full_name: string;
  job_title: string;
  phone: string;
  avatar_url: string | null;
}

const orNull = (v: string) => v.trim() || null;

/** Guarda el perfil; si falta la columna job_title, reintenta sin ella. */
export async function saveOwnerProfile(
  userId: string,
  draft: OwnerDraft,
  hasJobTitle: boolean,
): Promise<{ jobTitleSaved: boolean }> {
  const base = {
    user_id: userId,
    full_name: orNull(draft.full_name),
    phone: orNull(draft.phone),
    avatar_url: draft.avatar_url,
    updated_at: new Date().toISOString(),
  };
  const upsert = (payload: Record<string, unknown>) =>
    supabase
      .from("user_profiles")
      .upsert(payload as typeof base, { onConflict: "user_id" })
      .then(({ error }) => error);

  if (hasJobTitle) {
    const error = await upsert({ ...base, job_title: orNull(draft.job_title) });
    if (!error) return { jobTitleSaved: true };
    if (!isMissingColumnError(error)) throw new Error(error.message);
  }
  const error = await upsert(base);
  if (error) throw new Error(error.message);
  return { jobTitleSaved: false };
}

/** Guarda los datos de la agencia; las columnas nuevas solo si existen. */
export async function saveAgencyProfile(
  id: string,
  values: AgencyValues,
  hasExtended: boolean,
): Promise<void> {
  const fields = hasExtended
    ? [...AGENCY_TEXT_FIELDS, ...AGENCY_EXTENDED_FIELDS]
    : AGENCY_TEXT_FIELDS;
  const payload = Object.fromEntries(fields.map((f) => [f, orNull(values[f])]));
  // Las columnas nuevas no están en los tipos generados hasta aplicar la migración.
  const { error } = await supabase
    .from("pricing_settings")
    .update(payload as { agency_legal_name: string | null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
