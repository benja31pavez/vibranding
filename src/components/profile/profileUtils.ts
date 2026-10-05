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

/** Código de reautenticación que Supabase envía al email (6 dígitos). */
export const OTP_LENGTH = 6;
export const RESEND_COOLDOWN_SECONDS = 60;
export const INVALID_CODE_MESSAGE = "Código inválido o vencido. Pide uno nuevo.";
export const RATE_LIMIT_MESSAGE =
  "Pediste varios códigos seguidos. Espera un momento y vuelve a intentarlo.";

const OTP_RE = new RegExp(`^\\d{${OTP_LENGTH}}$`);

/** Deja solo dígitos (pegar "123 456" funciona) y corta al largo del código. */
export function sanitizeOtp(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function isValidOtp(code: string): boolean {
  return OTP_RE.test(code);
}

export interface PasswordChangeErrors {
  code?: string;
  password?: string;
}

/** Valida el paso 2 (código + nueva clave); objeto vacío = todo bien. */
export function validatePasswordChange(
  code: string,
  password: string,
  confirm: string,
): PasswordChangeErrors {
  const passwordMessage = passwordError(password, confirm);
  return {
    ...(isValidOtp(code) ? {} : { code: `Ingresa el código de ${OTP_LENGTH} dígitos.` }),
    ...(passwordMessage ? { password: passwordMessage } : {}),
  };
}

/** Segundos que faltan para poder reenviar el código (0 = ya se puede). */
export function resendSecondsLeft(sentAt: number | null, now: number): number {
  if (sentAt === null) return 0;
  const elapsed = Math.floor((now - sentAt) / 1000);
  return Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed);
}

export interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "over_sms_send_rate_limit",
]);
const INVALID_CODE_CODES = new Set([
  "reauthentication_not_valid",
  "reauthentication_needed",
  "reauth_nonce_missing",
]);

function isRateLimit(error: AuthErrorLike) {
  return (error.code !== undefined && RATE_LIMIT_CODES.has(error.code)) || error.status === 429;
}

/** Mensaje amable al fallar el envío del código (reauthenticate). */
export function sendCodeErrorMessage(error: AuthErrorLike): string {
  if (isRateLimit(error)) return RATE_LIMIT_MESSAGE;
  return "No pudimos enviar el código. Intenta de nuevo en unos minutos.";
}

/** Mensaje amable al fallar el cambio de contraseña con código (updateUser + nonce). */
export function changePasswordErrorMessage(error: AuthErrorLike): string {
  if (error.code !== undefined && INVALID_CODE_CODES.has(error.code)) return INVALID_CODE_MESSAGE;
  if (/nonce|reauthenticat/i.test(error.message ?? "")) return INVALID_CODE_MESSAGE;
  if (isRateLimit(error)) return RATE_LIMIT_MESSAGE;
  if (error.code === "same_password") return "La nueva contraseña debe ser distinta de la actual.";
  if (error.code === "weak_password") {
    return "La contraseña es muy débil. Prueba con una más larga o variada.";
  }
  return "No se pudo cambiar la contraseña. Intenta de nuevo.";
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
