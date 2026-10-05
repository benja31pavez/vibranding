/** Utilidades puras de "Editar perfil" (sin React), verificadas por scripts/check-profile.mjs. */
import { formatRut, isValidRut } from "@/lib/proposals/rut";
import type { AgencyField, AgencyValues } from "./profileData";

export const DEFAULT_JOB_TITLE = "Fundador";
export const PENDING_MIGRATION_HINT = "Disponible al aplicar la actualización de base de datos.";

export function initialsOf(name: string, fallback: string) {
  const source = name.trim() || fallback;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export const MIN_PASSWORD_LENGTH = 8;

export function passwordError(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password !== confirm) return "Las contraseñas no coinciden.";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_RE = /^(https?:\/\/)?[^\s.]+\.[^\s]+$/i;
const INSTAGRAM_RE = /^[a-z0-9._]{1,30}$/i;

export type AgencyErrors = Partial<Record<AgencyField, string>>;

/** Normaliza lo que se guarda: RUT con formato, Instagram sin @ y sitio con https://. */
export function normalizeAgency(values: AgencyValues): AgencyValues {
  const website = values.agency_website.trim();
  return {
    ...values,
    agency_tax_id: values.agency_tax_id.trim() ? formatRut(values.agency_tax_id) : "",
    agency_instagram: values.agency_instagram.trim().replace(/^@/, ""),
    agency_website: website && !/^https?:\/\//i.test(website) ? `https://${website}` : website,
  };
}

export function validateAgency(values: AgencyValues): AgencyErrors {
  const errors: AgencyErrors = {};
  const v = (f: AgencyField) => values[f].trim();
  if (v("agency_tax_id") && !isValidRut(v("agency_tax_id"))) {
    errors.agency_tax_id = "RUT inválido (ej.: 78.505.344-3).";
  }
  if (v("agency_email") && !EMAIL_RE.test(v("agency_email"))) {
    errors.agency_email = "Email inválido.";
  }
  if (v("agency_website") && !WEBSITE_RE.test(v("agency_website"))) {
    errors.agency_website = "Sitio inválido (ej.: vibranding.pro).";
  }
  if (v("agency_instagram") && !INSTAGRAM_RE.test(v("agency_instagram").replace(/^@/, ""))) {
    errors.agency_instagram = "Usuario de Instagram inválido.";
  }
  return errors;
}
