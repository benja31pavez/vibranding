import { z } from "zod";
import type { StatusTone } from "@/components/app";
import { PLANS, type PlanKey } from "@/lib/pricing/plans";

/** Estados de `prospects.estado` (CHECK prospects_estado_chk). */
export const PROSPECT_STATES = [
  "nuevo",
  "contactado",
  "respondio",
  "demo",
  "propuesta",
  "ganado",
  "frio",
  "perdido",
  "baja",
] as const;
export type ProspectState = (typeof PROSPECT_STATES)[number];

/** Columnas abiertas del kanban, en orden del embudo. */
export const OPEN_STATES = [
  "nuevo",
  "contactado",
  "respondio",
  "demo",
  "propuesta",
  "ganado",
] as const;
/**
 * "Frío": se guarda, no se insiste automáticamente y no tiene fecha de "no contactar".
 * Retomarlo es manual (moverlo a "nuevo" o "contactado"). Columna propia y visible.
 */
export const COLD_STATE = "frio" as const;
/** Estados a los que se "retoma" un prospecto frío. */
export const RESUME_STATES = ["nuevo", "contactado"] as const;
/** Estados que viven en la columna colapsada "Cerrados". */
export const CLOSED_STATES = ["perdido", "baja"] as const;

export const STATE_META: Readonly<Record<ProspectState, { label: string; tone: StatusTone }>> = {
  nuevo: { label: "Nuevo", tone: "neutral" },
  contactado: { label: "Contactado", tone: "info" },
  respondio: { label: "Respondió", tone: "info" },
  demo: { label: "Demo", tone: "warning" },
  propuesta: { label: "Propuesta", tone: "warning" },
  ganado: { label: "Ganado", tone: "success" },
  frio: { label: "Frío", tone: "info" },
  perdido: { label: "Perdido", tone: "neutral" },
  baja: { label: "Baja", tone: "danger" },
};

export function isProspectState(value: unknown): value is ProspectState {
  return typeof value === "string" && (PROSPECT_STATES as readonly string[]).includes(value);
}

export const BAJA_NOTICE =
  "Pidió no recibir más comunicaciones: no volver a contactar por ningún canal " +
  "(Ley 19.496 art. 28 B y Ley 21.719 de protección de datos personales).";

export const PLAN_KEYS = PLANS.map((p) => p.key) as [PlanKey, ...PlanKey[]];

const MAX_NAME = 120;
const MAX_SHORT = 80;
const MAX_FUENTE = 200;
const MAX_NOTES = 4000;
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS_RE = /^\+?[0-9\s().-]+$/;
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isPhone(value: string): boolean {
  const v = value.trim();
  if (!PHONE_CHARS_RE.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;
}

/** URL http(s) o dominio ("misitio.cl") → URL absoluta https. null si no es válida. */
export function normalizeWeb(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const candidate = /^https?:\/\//i.test(v) ? v : DOMAIN_RE.test(v) ? `https://${v}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "@usuario", "usuario" o URL de instagram.com → "usuario". null si no es válido. */
export function normalizeInstagram(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/instagram\.com/i.test(v)) {
    try {
      const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      const handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return HANDLE_RE.test(handle) ? handle : null;
    } catch {
      return null;
    }
  }
  const handle = v.replace(/^@+/, "");
  return HANDLE_RE.test(handle) ? handle : null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => v || null);

/** Esquema de un prospecto (formulario e importación). Devuelve valores listos para la BD. */
export const prospectSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(MAX_NAME, `Máximo ${MAX_NAME} caracteres`),
  rubro: optionalText(MAX_SHORT),
  comuna: optionalText(MAX_SHORT),
  web: z.string().transform((v, ctx) => {
    if (!v.trim()) return null;
    const url = normalizeWeb(v);
    if (!url)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa una URL válida (ej. misitio.cl)",
      });
    return url;
  }),
  instagram: z.string().transform((v, ctx) => {
    if (!v.trim()) return null;
    const handle = normalizeInstagram(v);
    if (!handle)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa @usuario o la URL del perfil",
      });
    return handle;
  }),
  email_publico: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!isEmail(v))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Correo con formato inválido" });
      return v.toLowerCase();
    }),
  telefono_publico: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!isPhone(v))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Teléfono inválido (ej. +56 9 1234 5678)",
        });
      return v;
    }),
  fuente: z
    .string()
    .trim()
    .min(1, "Indica de dónde sale el dato (obligatorio)")
    .max(MAX_FUENTE, `Máximo ${MAX_FUENTE} caracteres`),
  estado: z.enum(PROSPECT_STATES),
  producto_sugerido: z.union([z.enum(PLAN_KEYS), z.literal("")]).transform((v) => v || null),
  notas: optionalText(MAX_NOTES),
  ultimo_contacto: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!DATE_RE.test(v) || Number.isNaN(new Date(`${v}T12:00:00`).getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida" });
        return null;
      }
      return new Date(`${v}T12:00:00`).toISOString();
    }),
});

export type ProspectFormInput = z.input<typeof prospectSchema>;
export type ProspectValues = z.output<typeof prospectSchema>;

export const EMPTY_FORM: ProspectFormInput = {
  nombre: "",
  rubro: "",
  comuna: "",
  web: "",
  instagram: "",
  email_publico: "",
  telefono_publico: "",
  fuente: "",
  estado: "nuevo",
  producto_sugerido: "",
  notas: "",
  ultimo_contacto: "",
};

/** Errores de zod → { campo: mensaje } (primer error por campo). */
export function fieldErrors(error: z.ZodError): Partial<Record<keyof ProspectFormInput, string>> {
  const out: Partial<Record<keyof ProspectFormInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof ProspectFormInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Clave de deduplicación nombre+comuna (sin tildes, mayúsculas ni espacios extra). */
export function dedupeKey(nombre: string, comuna: string | null | undefined): string {
  return `${normalizeName(nombre)}|${normalizeName(comuna)}`;
}

/**
 * Marca que dejaba "Convertir en cliente" en las notas del prospecto antes de la v3
 * (ahora el vínculo es prospects.client_id). Se sigue leyendo para prospectos antiguos.
 */
const CLIENT_MARK_RE =
  /\[Cliente: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i;

export function clientMark(clientId: string): string {
  return `[Cliente: ${clientId}]`;
}

/** Id del cliente creado desde este prospecto: prospects.client_id (v3) o la marca en notas. */
export function convertedClientId(
  prospect: { client_id?: string | null; notas?: string | null } | null | undefined,
): string | null {
  return prospect?.client_id ?? prospect?.notas?.match(CLIENT_MARK_RE)?.[1] ?? null;
}

/**
 * ¿Se le pueden enviar correos de marketing? Solo con prospects.marketing_opt_in
 * (consentimiento propio desde /diagnostico, migración 20261012001900; si la
 * columna aún no existe, cuenta como false). La BAJA manda siempre: un prospecto
 * en estado 'baja' es "sin permiso" aunque el flag siga en true. Todo envío
 * futuro de marketing debe filtrar con esta función (hoy no existe ninguno).
 */
export function acceptsMarketingEmail(
  prospect: { estado?: string | null; marketing_opt_in?: boolean | null } | null | undefined,
): boolean {
  if (!prospect || prospect.estado === "baja") return false;
  return prospect.marketing_opt_in === true;
}

/** Motivo para revocar una baja (mismos límites que revoke_prospect_baja). */
export const REVOKE_MOTIVO_MIN = 5;
export const REVOKE_MOTIVO_MAX = 300;
/** Estados a los que puede volver un prospecto que sale de baja (revoke_prospect_baja). */
export const REVOKE_TARGET_STATES = [
  "nuevo",
  "contactado",
  "respondio",
  "demo",
  "propuesta",
  "perdido",
  "frio",
] as const;
export type RevokeTargetState = (typeof REVOKE_TARGET_STATES)[number];

const NO_CONTACT_RE = /No contactar antes de (\d{4}-\d{2}-\d{2})/;
export const NO_CONTACT_MONTHS = 6;

export function noContactNote(untilIso: string): string {
  return `No contactar antes de ${untilIso}`;
}

/** Fecha (YYYY-MM-DD) hasta la que no se debe contactar, si sigue vigente respecto de `today`. */
export function noContactUntil(notas: string | null | undefined, today: string): string | null {
  const until = notas?.match(NO_CONTACT_RE)?.[1];
  return until && until > today ? until : null;
}

/** Normaliza para comparar nombres (sin tildes, mayúsculas ni espacios extra). */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
