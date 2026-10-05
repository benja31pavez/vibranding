/**
 * Formulario público "Diagnóstico gratis de tu marca" (/diagnostico).
 * Compartido por el cliente (validación en vivo) y la server fn (validación real).
 */
import { z } from "zod";

export const DIAGNOSTICO_SOURCE = "web: diagnóstico";

export const GOALS = [
  { value: "consultas", label: "Más consultas por WhatsApp o formulario" },
  { value: "ventas", label: "Más ventas" },
  { value: "marca", label: "Una marca más profesional" },
  { value: "web", label: "Tener (o mejorar) mi página web" },
] as const;

export const BUDGETS = [
  { value: "", label: "Prefiero no decirlo" },
  { value: "menos-150", label: "Menos de $150.000 al mes" },
  { value: "150-300", label: "Entre $150.000 y $300.000 al mes" },
  { value: "mas-300", label: "Más de $300.000 al mes" },
  { value: "no-se", label: "Aún no lo sé" },
] as const;

export const PLAN_INTERESTS = ["marca-web", "contenido", "crecimiento"] as const;
export type PlanInterest = (typeof PLAN_INTERESTS)[number];

type GoalValue = (typeof GOALS)[number]["value"];
type BudgetValue = (typeof BUDGETS)[number]["value"];

const goalValues = GOALS.map((g) => g.value) as [GoalValue, ...GoalValue[]];
const budgetValues = BUDGETS.map((b) => b.value) as [BudgetValue, ...BudgetValue[]];

/** Teléfono chileno o internacional: 8 a 15 dígitos, con +, espacios o guiones. */
const PHONE_RE = /^\+?[\d\s()-]{8,20}$/;

/** Caracteres de control (incluye CR/LF): nunca válidos en campos de una línea. */
// eslint-disable-next-line no-control-regex -- intencional: elimina caracteres de control
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const NO_CONTROL = "Usa solo texto, sin saltos de línea ni caracteres especiales";

const requiredText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .min(2, msg)
    .max(max, `Máximo ${max} caracteres`)
    .refine((v) => !CONTROL_RE.test(v), NO_CONTROL);

/** Texto y versión EXACTOS del checkbox; se guardan en prospect_consents. Cambia la versión si cambias el texto. */
export const CONSENT_TEXT =
  "Acepto que Vibranding me contacte por este medio (WhatsApp o correo) para enviarme el diagnóstico.";
export const CONSENT_VERSION = "diagnostico-v1-2026-10";

/**
 * Consentimiento de MARKETING (Ley 19.628/21.719 y Ley 19.496 art. 28 B): opcional,
 * desmarcado por defecto e independiente del de arriba. Se guarda como su propia
 * fila en prospect_consents (purpose = 'marketing'). Cambia la versión si cambias el texto.
 */
export const MARKETING_CONSENT_TEXT =
  "Quiero recibir novedades y consejos de Vibranding por correo. Puedo darme de baja cuando quiera.";
export const MARKETING_CONSENT_VERSION = "marketing-v1-2026-10";

/** Largo máximo de "Información adicional" (texto libre del visitante). */
export const INFO_MAX = 600;

/**
 * Marca de las líneas de nota con la "Información adicional" del visitante.
 * Esas líneas son texto libre: recommend.ts las ignora por completo.
 */
export const INFO_NOTE_MARK = "Info adicional";
/** Largo máx. de una línea de nota (límite de append_prospect_note). */
const NOTE_LINE_MAX = 300;
const INFO_FIRST_PREFIX = `${INFO_NOTE_MARK} (texto del visitante, no verificado): `;
const INFO_NEXT_PREFIX = `${INFO_NOTE_MARK} (cont.): `;

/**
 * "Información adicional" → líneas de nota seguras: sin saltos de línea ni
 * controles (el visitante no puede abrir una línea "Diagnóstico web" propia),
 * máx. INFO_MAX caracteres y cada línea ≤ 300 (append_prospect_note).
 */
export function buildInfoNoteLines(raw: string | null | undefined): string[] {
  const text = (raw ?? "")
    // eslint-disable-next-line no-control-regex -- intencional: elimina caracteres de control
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, INFO_MAX);
  const lines: string[] = [];
  let rest = text;
  while (rest) {
    const prefix = lines.length === 0 ? INFO_FIRST_PREFIX : INFO_NEXT_PREFIX;
    const room = NOTE_LINE_MAX - prefix.length;
    lines.push(`${prefix}${rest.slice(0, room).trim()}`);
    rest = rest.slice(room).trim();
  }
  return lines;
}

/** Honeypot lleno (cualquier largo) = bot. */
export function isHoneypotHit(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const v = (input as { website?: unknown }).website;
  return typeof v === "string" && v.trim().length > 0;
}

export const DiagnosticoInput = z.object({
  negocio: requiredText(120, "Escribe el nombre de tu negocio"),
  rubro: requiredText(80, "Cuéntanos tu rubro"),
  comuna: requiredText(80, "Escribe tu comuna"),
  presencia: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .refine((v) => !CONTROL_RE.test(v), NO_CONTROL)
    .optional()
    .or(z.literal("")),
  whatsapp: z
    .string()
    .trim()
    .regex(PHONE_RE, "Escribe un WhatsApp válido, por ejemplo +56 9 1234 5678")
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Escribe un WhatsApp válido"),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(255),
  objetivo: z.enum(goalValues, { message: "Elige qué quieres lograr con Vibranding" }),
  presupuesto: z.enum(budgetValues).optional().default(""),
  plan: z.enum(PLAN_INTERESTS).optional(),
  /** Texto libre opcional; admite saltos de línea (se aplanan al guardarlo en la nota). */
  info: z
    .string()
    .trim()
    .max(INFO_MAX, `Máximo ${INFO_MAX} caracteres`)
    .optional()
    .or(z.literal("")),
  consentimiento: z
    .boolean()
    .refine((v) => v, "Marca la casilla para que podamos enviarte el diagnóstico"),
  /** Consentimiento de marketing: opcional e independiente (por defecto false). */
  marketing: z.boolean().optional().default(false),
  /** Campo oculto: solo lo llenan los bots (se revisa antes con isHoneypotHit). */
  website: z.string().optional(),
});

export type DiagnosticoInput = z.infer<typeof DiagnosticoInput>;

export type DiagnosticoResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "invalid" | "not_saved" };

export function goalLabel(value: string): string {
  return GOALS.find((g) => g.value === value)?.label ?? value;
}

export function budgetLabel(value: string | undefined): string | null {
  if (!value) return null;
  return BUDGETS.find((b) => b.value === value)?.label ?? null;
}

/**
 * Separa "Instagram o web" en una de las dos columnas del prospecto.
 * "@marca", "instagram.com/marca" → instagram "@marca"; un dominio o URL → web.
 */
export function splitPresence(raw: string | undefined): {
  instagram: string | null;
  web: string | null;
} {
  const value = (raw ?? "").trim();
  if (!value) return { instagram: null, web: null };
  const ig = value.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  if (ig?.[1]) return { instagram: `@${ig[1]}`, web: null };
  const handle = value.match(/^@?([A-Za-z0-9._]{1,30})$/);
  if (value.startsWith("@") && handle?.[1]) return { instagram: `@${handle[1]}`, web: null };
  if (/^(?:https?:\/\/)?[^\s/]+\.[a-z]{2,}(?:[/?#]\S*)?$/i.test(value)) {
    return { instagram: null, web: /^https?:\/\//i.test(value) ? value : `https://${value}` };
  }
  if (handle?.[1]) return { instagram: `@${handle[1]}`, web: null };
  return { instagram: null, web: null };
}
