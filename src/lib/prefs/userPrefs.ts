/**
 * Preferencias personales del usuario (user_profiles.timezone / user_profiles.language).
 * Las columnas llegan con la migración 20261012001700_preferencias_usuario.sql;
 * mientras no esté aplicada se usan los valores por defecto y la UI queda deshabilitada.
 */
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "./timezones";

export type PrefLanguage = "es" | "en";

export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: PrefLanguage; label: string }> = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export const CURRENCY_OPTIONS = [{ value: "CLP", label: "CLP · Peso chileno" }] as const;
export const DATE_FORMAT_OPTIONS = [{ value: "dd-mm-aaaa", label: "dd-mm-aaaa" }] as const;

export interface UserPrefs {
  timeZone: string;
  language: PrefLanguage;
}

export const DEFAULT_PREFS: UserPrefs = { timeZone: DEFAULT_TIME_ZONE, language: "es" };

export function isPrefLanguage(value: unknown): value is PrefLanguage {
  return value === "es" || value === "en";
}

export interface LoadedPrefs {
  prefs: UserPrefs;
  /** false si las columnas aún no existen (migración sin aplicar). */
  hasPrefs: boolean;
}

/** Lee la fila de user_profiles (select "*") tolerando columnas ausentes o valores inválidos. */
export function toUserPrefs(row: Record<string, unknown> | null): LoadedPrefs {
  const timeZone = isValidTimeZone(row?.timezone) ? row.timezone : DEFAULT_PREFS.timeZone;
  const language = isPrefLanguage(row?.language) ? row.language : DEFAULT_PREFS.language;
  return {
    prefs: { timeZone, language },
    // Sin fila no se sabe: se intenta guardar y, si falla por columna, se informa.
    hasPrefs: row === null || "timezone" in row,
  };
}

/** Valida lo que se va a guardar; devuelve el mensaje de error o null. */
export function prefsError(prefs: UserPrefs): string | null {
  if (!isValidTimeZone(prefs.timeZone)) return "Elige una zona horaria de la lista.";
  if (!isPrefLanguage(prefs.language)) return "Elige Español o English.";
  return null;
}
