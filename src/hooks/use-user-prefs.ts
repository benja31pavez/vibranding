import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageContext";
import { isMissingColumnError } from "@/lib/db/missingColumn";
import { formatDateTimeInZone } from "@/lib/prefs/formatInZone";
import { DEFAULT_TIME_ZONE } from "@/lib/prefs/timezones";
import {
  DEFAULT_PREFS,
  toUserPrefs,
  type LoadedPrefs,
  type UserPrefs,
} from "@/lib/prefs/userPrefs";

export const userPrefsKey = (userId: string) => ["user-prefs", userId] as const;

const PREFS_STALE_MS = 5 * 60_000;

async function loadUserPrefs(userId: string): Promise<LoadedPrefs> {
  // "*" para tolerar que las columnas timezone/language aún no existan.
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[prefs] error al cargar las preferencias", error);
    throw new Error("No pudimos cargar tus preferencias.");
  }
  return toUserPrefs(data as Record<string, unknown> | null);
}

/** Query de las preferencias del usuario (compartida por el perfil y los formateadores). */
export function useUserPrefsQuery() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: userPrefsKey(userId),
    enabled: Boolean(userId),
    staleTime: PREFS_STALE_MS,
    queryFn: () => loadUserPrefs(userId),
  });
}

/**
 * Preferencias del usuario + formateadores de horas en su zona.
 * Mientras cargan (o si fallan) se usa hora de Chile, igual que antes.
 */
export function useUserPrefs() {
  const { data } = useUserPrefsQuery();
  const prefs = data?.prefs ?? DEFAULT_PREFS;
  const timeZone = prefs.timeZone;
  return {
    prefs,
    timeZone,
    isChileTime: timeZone === DEFAULT_TIME_ZONE,
    formatDateTime: useCallback(
      (iso: string | null) => formatDateTimeInZone(iso, timeZone),
      [timeZone],
    ),
  };
}

/** Aplica el idioma guardado al sitio público (LanguageContext) al entrar al panel. */
export function useSyncLanguagePref() {
  const { data } = useUserPrefsQuery();
  const { lang, setLang } = useLang();
  const saved = data?.hasPrefs ? data.prefs.language : null;
  useEffect(() => {
    if (saved && saved !== lang) setLang(saved);
    // Solo cuando cambia lo guardado; un cambio manual en el sitio público no se pisa en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
}

export class PrefsMigrationPendingError extends Error {
  constructor() {
    super("Las preferencias estarán disponibles al aplicar la actualización de base de datos.");
    this.name = "PrefsMigrationPendingError";
  }
}

/** Guarda zona horaria e idioma en user_profiles (upsert de la fila del propio usuario). */
export async function saveUserPrefs(userId: string, prefs: UserPrefs): Promise<void> {
  const payload = {
    user_id: userId,
    timezone: prefs.timeZone,
    language: prefs.language,
    updated_at: new Date().toISOString(),
  };
  // Las columnas nuevas no están en los tipos generados hasta aplicar la migración.
  const { error } = await supabase
    .from("user_profiles")
    .upsert(payload as unknown as { user_id: string }, { onConflict: "user_id" });
  if (!error) return;
  if (isMissingColumnError(error)) throw new PrefsMigrationPendingError();
  throw new Error(error.message);
}
