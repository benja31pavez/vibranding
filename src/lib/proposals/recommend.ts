/**
 * Propuesta rápida desde un prospecto: reglas puras (sin red, sin IA).
 *
 *  - `readDiagnosticoSignals`: lee objetivo / presupuesto / plan de interés de la
 *    nota que deja el formulario /diagnostico en `prospects.notas`
 *    (ver buildLeadNote en src/lib/leads/diagnostico.server.ts).
 *  - `recommendPlan`: elige el plan a precargar en el editor.
 *  - `buildProposalIntro`: párrafo de presentación por plantillas.
 *  - `shouldAdvanceToProposal`: si el prospecto debe pasar a "propuesta".
 *
 * Plan Mantención (`returningClientsOnly`): nunca se recomienda solo. Solo se
 * respeta si el equipo lo eligió en la ficha Y hay señal de que el prospecto ya
 * fue cliente (`wasClient`). Sin esa señal, nunca.
 *
 * Presupuesto: se compara con el precio NETO del plan (lo que la pyme ve como
 * precio de lista "$129.990 + IVA"; el IVA lo recupera como crédito fiscal).
 *
 * Revisión: `npm run check:recommend`.
 */
import { BUDGETS, GOALS, INFO_NOTE_MARK, PLAN_INTERESTS } from "@/lib/leads/diagnostico.schema";
import { PLANS, findPlan, planPriceLabel, type Plan, type PlanKey } from "@/lib/pricing/plans";

export type GoalValue = (typeof GOALS)[number]["value"];
export type BudgetValue = Exclude<(typeof BUDGETS)[number]["value"], "">;

export interface DiagnosticoSignals {
  objetivo: GoalValue | null;
  presupuesto: BudgetValue | null;
  planInteres: PlanKey | null;
}

const EMPTY_SIGNALS: DiagnosticoSignals = { objetivo: null, presupuesto: null, planInteres: null };

/** Último valor de "<campo>: valor" en las notas (los campos van separados por " · "). */
function lastField(notes: string, field: string): string | null {
  const re = new RegExp(`${field}:\\s*([^·\\n]+)`, "gi");
  let value: string | null = null;
  for (const match of notes.matchAll(re)) value = match[1]?.trim() ?? null;
  return value;
}

/** Marca con la que empieza la nota del diagnóstico (buildLeadNote). */
export const DIAGNOSTICO_NOTE_MARK = "Diagnóstico web";
/** Desde aquí la nota trae texto libre del visitante: nunca se lee como dato. */
const FREE_TEXT_FIELD = /presencia:/i;

/**
 * Solo las líneas del diagnóstico y solo hasta "presencia:": lo que escribe el
 * visitante en ese campo no puede colar un "quiere:" o "plan de interés:" falso.
 * Las líneas de "Información adicional" (INFO_NOTE_MARK, texto libre) se ignoran
 * enteras aunque traigan un "Diagnóstico web" escrito por el visitante.
 */
function trustedDiagnosticoText(notes: string): string {
  return notes
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith(INFO_NOTE_MARK)) return "";
      const start = line.indexOf(DIAGNOSTICO_NOTE_MARK);
      return start < 0 ? "" : (line.slice(start).split(FREE_TEXT_FIELD)[0] ?? "");
    })
    .filter(Boolean)
    .join("\n");
}

/** Objetivo, presupuesto y plan de interés del diagnóstico web (null si no hay nota). */
export function readDiagnosticoSignals(rawNotes: string | null | undefined): DiagnosticoSignals {
  const notes = rawNotes ? trustedDiagnosticoText(rawNotes) : "";
  if (!notes) return EMPTY_SIGNALS;
  const goalLabel = lastField(notes, "quiere");
  const budgetLabel = lastField(notes, "presupuesto");
  const planRaw = lastField(notes, "plan de interés");
  const goal = GOALS.find((g) => g.label === goalLabel)?.value ?? null;
  const budget = BUDGETS.find((b) => b.value !== "" && b.label === budgetLabel)?.value ?? null;
  const plan = (PLAN_INTERESTS as readonly string[]).includes(planRaw ?? "")
    ? (planRaw as PlanKey)
    : null;
  return { objetivo: goal, presupuesto: (budget || null) as BudgetValue | null, planInteres: plan };
}

// ------------------------------------------------------------------ reglas

/** Tope mensual (CLP) que declaró el lead. Sin entrada = sin tope. */
export const BUDGET_MONTHLY_CAP_CLP: Readonly<Partial<Record<BudgetValue, number>>> = {
  "menos-150": 150_000,
  "150-300": 300_000,
};

/** Plan que mejor calza con lo que el lead quiere lograr. */
export const GOAL_TO_PLAN: Readonly<Record<GoalValue, PlanKey>> = {
  consultas: "crecimiento",
  ventas: "crecimiento",
  marca: "marca-web",
  web: "marca-web",
};

/** Plan de respaldo cuando el tope de presupuesto no alcanza para ningún plan mensual. */
export const BUDGET_FALLBACK_PLAN: PlanKey = "marca-web";

export type RecommendationSource = "ficha" | "plan_interes" | "objetivo" | "sin_datos";

export interface PlanRecommendation {
  planKey: PlanKey | null;
  source: RecommendationSource;
  /** true si se bajó de plan por el presupuesto declarado. */
  adjustedForBudget: boolean;
  /** Explicación corta para el editor. */
  reason: string;
}

export interface RecommendInput {
  /** `prospects.producto_sugerido` (lo elige el equipo a mano: manda sobre todo). */
  productoSugerido: string | null | undefined;
  signals: DiagnosticoSignals;
  /** true solo si hay señal de que ya fue cliente (p. ej. el prospecto tiene client_id). */
  wasClient?: boolean;
}

/** Planes que se pueden recomendar a cualquier prospecto (nunca los de ex clientes). */
const OPEN_PLANS: readonly Plan[] = PLANS.filter((p) => !p.returningClientsOnly);

function recommendable(plan: Plan | null, wasClient: boolean): Plan | null {
  if (!plan) return null;
  return plan.returningClientsOnly && !wasClient ? null : plan;
}

/** Si el plan mensual supera el tope, el mensual más caro que sí cabe (o el de respaldo). */
function fitBudget(plan: Plan, budget: BudgetValue | null): { plan: Plan; adjusted: boolean } {
  const cap = budget ? BUDGET_MONTHLY_CAP_CLP[budget] : undefined;
  if (cap === undefined || plan.billing !== "monthly" || plan.netPrice <= cap)
    return { plan, adjusted: false };
  const fitting = OPEN_PLANS.filter((p) => p.billing === "monthly" && p.netPrice <= cap).sort(
    (a, b) => b.netPrice - a.netPrice,
  );
  const fallback = fitting[0] ?? findPlan(BUDGET_FALLBACK_PLAN);
  return fallback ? { plan: fallback, adjusted: true } : { plan, adjusted: false };
}

const SOURCE_REASON: Readonly<Record<RecommendationSource, string>> = {
  ficha: "Producto sugerido en la ficha del prospecto.",
  plan_interes: "Plan que marcó en el diagnóstico web.",
  objetivo: "Según lo que quiere lograr (diagnóstico web).",
  sin_datos: "Sin datos del diagnóstico: elige el plan a mano.",
};

/** Regla: ficha > plan de interés > objetivo > sin plan. Las dos del diagnóstico respetan el presupuesto. */
export function recommendPlan({
  productoSugerido,
  signals,
  wasClient = false,
}: RecommendInput): PlanRecommendation {
  const manual = recommendable(findPlan(productoSugerido), wasClient);
  if (manual)
    return {
      planKey: manual.key,
      source: "ficha",
      adjustedForBudget: false,
      reason: SOURCE_REASON.ficha,
    };

  const fromDiagnostico: [RecommendationSource, PlanKey | null][] = [
    ["plan_interes", signals.planInteres],
    ["objetivo", signals.objetivo ? GOAL_TO_PLAN[signals.objetivo] : null],
  ];
  for (const [source, key] of fromDiagnostico) {
    const plan = recommendable(findPlan(key), false);
    if (!plan) continue;
    const fitted = fitBudget(plan, signals.presupuesto);
    const reason = fitted.adjusted
      ? `${SOURCE_REASON[source]} Ajustado al presupuesto declarado.`
      : SOURCE_REASON[source];
    return { planKey: fitted.plan.key, source, adjustedForBudget: fitted.adjusted, reason };
  }
  return {
    planKey: null,
    source: "sin_datos",
    adjustedForBudget: false,
    reason: SOURCE_REASON.sin_datos,
  };
}

// ------------------------------------------------------------------ intro

/** Qué quiere lograr, en minúscula para ir dentro de una frase. */
export const GOAL_PHRASE: Readonly<Record<GoalValue, string>> = {
  consultas: "recibir más consultas por WhatsApp o formulario",
  ventas: "vender más",
  marca: "tener una marca más profesional",
  web: "tener (o mejorar) su página web",
};

/** Objetivos donde tiene sentido mencionar el chatbot (siempre como adicional pagado). */
export const CHATBOT_HINT_GOALS: readonly GoalValue[] = ["consultas"];

export const INTRO_MAX_CHARS = 900;
/** Largo máximo de cada dato del prospecto dentro del mensaje (el resto se corta con "…"). */
export const INTRO_FIELD_MAX_CHARS = 60;

export interface IntroInput {
  nombre: string;
  rubro: string | null | undefined;
  comuna: string | null | undefined;
  objetivo: GoalValue | null;
  planKey: string | null;
}

function clean(value: string | null | undefined): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > INTRO_FIELD_MAX_CHARS
    ? `${text.slice(0, INTRO_FIELD_MAX_CHARS - 1).trimEnd()}…`
    : text;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function contextSentence(rubro: string, comuna: string): string | null {
  if (rubro && comuna) return `Vimos que trabajan en ${lowerFirst(rubro)} en ${comuna}.`;
  if (rubro) return `Vimos que trabajan en ${lowerFirst(rubro)}.`;
  if (comuna) return `Vimos que están en ${comuna}.`;
  return null;
}

/**
 * Párrafo corto de presentación. Solo usa datos del prospecto y del plan:
 * no promete resultados, no inventa cifras y el chatbot va como adicional con costo aparte.
 */
export function buildProposalIntro(input: IntroInput): string {
  const nombre = clean(input.nombre) || "su negocio";
  const plan = findPlan(input.planKey);
  const sentences = [
    `Hola, equipo de ${nombre}: gracias por su tiempo.`,
    contextSentence(clean(input.rubro), clean(input.comuna)),
    input.objetivo ? `Nos contaron que su prioridad es ${GOAL_PHRASE[input.objetivo]}.` : null,
    plan
      ? `Para partir les proponemos el ${plan.label} (${planPriceLabel(plan)}): ${lowerFirst(plan.description)}`
      : "Les preparamos una propuesta a la medida de lo que conversamos.",
    input.objetivo && CHATBOT_HINT_GOALS.includes(input.objetivo)
      ? "Si más adelante quieren responder consultas de forma automática, el chatbot de WhatsApp se puede sumar como servicio adicional, con costo aparte."
      : null,
    "En el link está el detalle, las condiciones y cómo aceptar. Cualquier duda, nos escriben.",
  ];
  return sentences.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ estado

/** Estado del embudo al que pasa un prospecto con propuesta creada. */
export const PROPOSAL_STAGE = "propuesta" as const;
/** Únicos estados que avanzan solos a "propuesta" (nunca frío, perdido, baja ni ganado). */
export const PRE_PROPOSAL_STATES = ["nuevo", "contactado", "respondio", "demo"] as const;

export function shouldAdvanceToProposal(estado: string | null | undefined): boolean {
  return (PRE_PROPOSAL_STATES as readonly string[]).includes(estado ?? "");
}

/** Se puede crear una propuesta (no a una baja: pidió no ser contactado). */
export function canCreateProposalFor(estado: string | null | undefined): boolean {
  return estado !== "baja";
}
