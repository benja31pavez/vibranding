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

const requiredText = (max: number, msg: string) => z.string().trim().min(2, msg).max(max, `Máximo ${max} caracteres`);

export const DiagnosticoInput = z.object({
  negocio: requiredText(120, "Escribe el nombre de tu negocio"),
  rubro: requiredText(80, "Cuéntanos tu rubro"),
  comuna: requiredText(80, "Escribe tu comuna"),
  presencia: z.string().trim().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  whatsapp: z
    .string()
    .trim()
    .regex(PHONE_RE, "Escribe un WhatsApp válido, por ejemplo +56 9 1234 5678")
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Escribe un WhatsApp válido"),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(255),
  objetivo: z.enum(goalValues, { message: "Elige qué quieres lograr" }),
  presupuesto: z.enum(budgetValues).optional().default(""),
  plan: z.enum(PLAN_INTERESTS).optional(),
  consentimiento: z.boolean().refine((v) => v, "Necesitamos tu autorización para contactarte"),
  /** Campo oculto: solo lo llenan los bots. */
  website: z.string().max(200).optional(),
});

export type DiagnosticoInput = z.infer<typeof DiagnosticoInput>;

export type DiagnosticoResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "invalid" };

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
export function splitPresence(raw: string | undefined): { instagram: string | null; web: string | null } {
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
