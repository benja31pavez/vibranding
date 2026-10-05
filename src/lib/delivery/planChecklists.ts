/**
 * Plantillas del plan: tareas estándar por etapa y objetivos estándar por plan.
 *
 * Fuente única. Para cambiar un título, un responsable, una meta o qué señal de
 * la plataforma marca una tarea como "Detectado ✓ — revisar", edita solo
 * `STAGE_CHECKLISTS` y `PLAN_OBJECTIVES`. Las claves (`key`) son estables: si
 * cambias una clave, para los clientes existentes es una tarea nueva.
 *
 * Al abrir el Plan (o al guardar el plan del cliente) se crean las que falten
 * (ver `./planTemplateSeed`). Cada tarea creada lleva el marcador
 * `[plantilla:<etapa>:<clave>]` en la descripción; cada objetivo, su
 * `template_key` (o, sin la migración, se reconoce por el título).
 *
 * Módulo puro: sin Supabase ni reloj.
 */
import type { PlanKey } from "@/lib/pricing/plans";
import type { AdsPlatform } from "@/lib/ads-billing/combined";
import type { PlanStage, StageKey } from "./planStages";
import type { TeamMemberKey } from "./team";

// ─── Señales de la plataforma ───────────────────────────────────────────────

/**
 * Datos de la plataforma que indican que una tarea probablemente ya está
 * hecha. Nunca completan la tarea solas: se muestra "Detectado ✓ — revisar" y
 * alguien la confirma (ver `./planSignals`).
 */
export const PLAN_SIGNALS = [
  "intake_submitted",
  "audience_defined",
  "logo_file",
  "brand_colors",
  "client_files",
  "meta_linked",
  "google_linked",
  "ads_billing_verified",
  "landing_published",
  "landing_contact",
  "landing_url",
  "multilink_published",
  "report_generated",
  "report_sent",
] as const;
export type PlanSignal = (typeof PLAN_SIGNALS)[number];

/** Qué se detectó (texto corto del badge, junto a "Detectado ✓ — revisar"). */
export const SIGNAL_LABELS: Readonly<Record<PlanSignal, string>> = {
  intake_submitted: "El cliente completó el onboarding",
  audience_defined: "Público objetivo cargado en el onboarding",
  logo_file: "Hay un archivo de logo subido",
  brand_colors: "Colores de marca cargados",
  client_files: "El cliente subió archivos",
  meta_linked: "Cuenta de Meta conectada",
  google_linked: "Cuenta de Google Ads conectada",
  ads_billing_verified: "Medio de pago verificado",
  landing_published: "Landing publicada",
  landing_contact: "Landing con WhatsApp y formulario activos",
  landing_url: "Landing con URL creada",
  multilink_published: "Multilink publicado",
  report_generated: "Reporte del mes generado",
  report_sent: "Reporte del mes enviado",
};

// ─── Tareas estándar por etapa ──────────────────────────────────────────────

export interface ChecklistTask {
  /** Clave estable dentro de la etapa (minúsculas, números y guiones). */
  readonly key: string;
  readonly title: string;
  /** Título distinto según el plan (p. ej. cantidad de piezas). */
  readonly titleByPlan?: Partial<Readonly<Record<PlanKey, string>>>;
  /** Responsable; sin valor, el de la etapa en el plan del cliente. */
  readonly owner?: TeamMemberKey;
  /** Señal de la plataforma que la marca como "Detectado ✓ — revisar". */
  readonly signal?: PlanSignal;
  /** Solo en estos planes (sin valor: en todos los que tengan la etapa). */
  readonly plans?: readonly PlanKey[];
  /** Solo si el cliente publicita en esa plataforma (o aún no lo dijo). */
  readonly adsPlatform?: AdsPlatform;
}

/** Piezas al mes por plan (deben coincidir con `./monthPlan`). */
export const PIECES_PER_MONTH = { contenido: 12, crecimiento: 12, mantencion: 8 } as const;

/** Tareas estándar de cada etapa. Edita aquí. */
export const STAGE_CHECKLISTS: Readonly<Record<StageKey, readonly ChecklistTask[]>> = {
  estrategia: [
    {
      key: "brief",
      title: "Reunión de inicio y brief completo",
      signal: "intake_submitted",
    },
    {
      key: "publico",
      title: "Definir público objetivo y propuesta de valor",
      signal: "audience_defined",
    },
    { key: "competencia", title: "Análisis de 3 competidores" },
    { key: "tono", title: "Definir tono de comunicación" },
  ],
  branding: [
    {
      key: "logo",
      title: "Logo en PNG (fondo transparente) y formatos (SVG/PDF, horizontal y cuadrado)",
      owner: "antonia",
      signal: "logo_file",
    },
    {
      key: "paleta",
      title: "Paleta de colores y tipografías",
      owner: "antonia",
      signal: "brand_colors",
    },
    { key: "kit", title: "Kit de marca entregado", owner: "antonia" },
    {
      key: "plantillas",
      title: "Plantillas de posts e historias",
      owner: "antonia",
      plans: ["crecimiento"],
    },
  ],
  diseno: [
    {
      key: "piezas",
      title: `${PIECES_PER_MONTH.contenido} piezas del mes diseñadas`,
      titleByPlan: { mantencion: `${PIECES_PER_MONTH.mantencion} piezas del mes diseñadas` },
    },
    { key: "plantillas", title: "Plantillas de posts e historias al día" },
  ],
  planificacion: [
    { key: "calendario", title: "Calendario del mes aprobado" },
    { key: "copys", title: "Copys revisados" },
    { key: "aprobacion", title: "Aprobación del cliente en el portal" },
    {
      key: "reporte",
      title: "Reporte del mes",
      plans: ["mantencion"],
      signal: "report_generated",
    },
  ],
  contenido: [
    { key: "calendario", title: "Calendario del mes aprobado", owner: "benjamin" },
    { key: "piezas", title: `${PIECES_PER_MONTH.crecimiento} piezas del mes` },
    { key: "copys", title: "Copys revisados", owner: "benjamin" },
    { key: "aprobacion", title: "Aprobación del cliente en el portal", owner: "benjamin" },
  ],
  ads: [
    {
      key: "cuenta-meta",
      title: "Cuenta publicitaria de Meta vinculada",
      signal: "meta_linked",
      adsPlatform: "meta",
    },
    {
      key: "cuenta-google",
      title: "Cuenta de Google Ads vinculada",
      signal: "google_linked",
      adsPlatform: "google",
    },
    {
      key: "pago",
      title: "Medio de pago del cliente verificado",
      signal: "ads_billing_verified",
    },
    { key: "pixel", title: "Píxel y conversiones configurados" },
    { key: "publico-presupuesto", title: "Público y presupuesto aprobados" },
    { key: "primera-campana", title: "Primera campaña publicada" },
  ],
  landing: [
    { key: "insumos", title: "Textos y fotos recibidos", signal: "client_files" },
    { key: "url", title: "Dominio o URL definida", signal: "landing_url" },
    { key: "publicada", title: "Landing publicada", signal: "landing_published" },
    {
      key: "pruebas",
      title: "Botón de WhatsApp y formulario probados",
      signal: "landing_contact",
    },
  ],
  chatbot: [
    { key: "faq", title: "Preguntas frecuentes recopiladas" },
    { key: "flujo", title: "Flujo aprobado" },
    { key: "whatsapp", title: "Número de WhatsApp conectado" },
    { key: "prueba", title: "Prueba completa" },
  ],
  optimizacion: [
    { key: "google-business", title: "Ficha de Google Business revisada" },
    {
      key: "instagram",
      title: "Perfil de Instagram optimizado (bio, destacadas y link)",
      signal: "multilink_published",
    },
    { key: "revision-semanal", title: "Revisión semanal de campañas" },
  ],
  reporte: [
    { key: "generado", title: "Reporte mensual generado", signal: "report_generated" },
    { key: "enviado", title: "Reporte revisado y enviado", signal: "report_sent" },
  ],
  entrega: [
    { key: "archivos", title: "Entrega de archivos finales" },
    { key: "confirmacion", title: "Confirmación del cliente" },
  ],
};

// ─── Objetivos estándar por plan ────────────────────────────────────────────

export type ObjectiveCategory = "growth" | "engagement" | "sales" | "branding" | "other";

export interface ChecklistObjective {
  /** Clave estable dentro del plan. */
  readonly key: string;
  readonly title: string;
  /** Unidad de la métrica (se guarda en `objectives.unit`). */
  readonly metric: string;
  readonly category: ObjectiveCategory;
  /** Meta por defecto; null = el equipo la define con el cliente. */
  readonly target: number | null;
}

/** Horas máximas para que el cliente apruebe (objetivo de Contenido). */
export const APPROVAL_MAX_HOURS = 48;
/** Plazo de entrega del kit + landing (Marca + Web). */
export const MARCA_WEB_DELIVERY_LABEL = "2 a 3 semanas";

const PIECES_OBJECTIVE = (pieces: number): ChecklistObjective => ({
  key: "piezas-mes",
  title: `Publicar ${pieces} piezas al mes`,
  metric: "piezas",
  category: "engagement",
  target: pieces,
});

/** Objetivos estándar de cada plan. Edita aquí. */
export const PLAN_OBJECTIVES: Readonly<Record<PlanKey, readonly ChecklistObjective[]>> = {
  contenido: [
    PIECES_OBJECTIVE(PIECES_PER_MONTH.contenido),
    {
      key: "aprobacion-48h",
      title: `Aprobación del cliente en ≤${APPROVAL_MAX_HOURS} h`,
      metric: "horas",
      category: "other",
      target: null,
    },
  ],
  crecimiento: [
    {
      key: "leads-whatsapp",
      title: "Leads por WhatsApp al mes",
      metric: "leads",
      category: "sales",
      target: null,
    },
    {
      key: "costo-por-lead",
      title: "Costo por lead",
      metric: "CLP",
      category: "sales",
      target: null,
    },
    PIECES_OBJECTIVE(PIECES_PER_MONTH.crecimiento),
  ],
  "marca-web": [
    {
      key: "entrega-72h",
      title: `Entregar kit de marca y landing en ${MARCA_WEB_DELIVERY_LABEL}`,
      metric: "horas hábiles",
      category: "branding",
      target: null,
    },
  ],
  mantencion: [PIECES_OBJECTIVE(PIECES_PER_MONTH.mantencion)],
};

// ─── Selección según el cliente ─────────────────────────────────────────────

/** Lo que adapta la plantilla a cada cliente. */
export interface ChecklistContext {
  /** Plan normalizado (null = sin plan: no se crea nada). */
  readonly planKey: PlanKey | null;
  /** Etapas del plan del cliente (incluye adicionales contratados). */
  readonly stages: readonly PlanStage[];
  /** Dónde publicita (onboarding); null = no respondió (se incluyen ambas). */
  readonly adsPlatforms: readonly AdsPlatform[] | null;
}

export interface PlannedTask {
  /** "tarea:<etapa>:<clave>" (clave del registro de plantillas creadas). */
  readonly itemKey: string;
  readonly stage: StageKey;
  readonly key: string;
  readonly title: string;
  readonly owner: TeamMemberKey;
  readonly signal: PlanSignal | null;
}

export interface PlannedObjective extends ChecklistObjective {
  /** "objetivo:<plan>:<clave>". */
  readonly itemKey: string;
}

function includesTask(task: ChecklistTask, ctx: ChecklistContext): boolean {
  if (!ctx.planKey) return false;
  if (task.plans && !task.plans.includes(ctx.planKey)) return false;
  if (task.adsPlatform && ctx.adsPlatforms && !ctx.adsPlatforms.includes(task.adsPlatform)) {
    return false;
  }
  return true;
}

export function taskItemKey(stage: StageKey, key: string): string {
  return `tarea:${stage}:${key}`;
}

export function objectiveItemKey(planKey: PlanKey, key: string): string {
  return `objetivo:${planKey}:${key}`;
}

/** Tareas estándar del cliente, en el orden de sus etapas. */
export function checklistForPlan(ctx: ChecklistContext): PlannedTask[] {
  const planKey = ctx.planKey;
  if (!planKey) return [];
  return ctx.stages.flatMap((stage) =>
    STAGE_CHECKLISTS[stage.key]
      .filter((t) => includesTask(t, ctx))
      .map((t) => ({
        itemKey: taskItemKey(stage.key, t.key),
        stage: stage.key,
        key: t.key,
        title: t.titleByPlan?.[planKey] ?? t.title,
        owner: t.owner ?? stage.owner,
        signal: t.signal ?? null,
      })),
  );
}

/** Objetivos estándar del plan. */
export function objectivesForPlan(planKey: PlanKey | null): PlannedObjective[] {
  if (!planKey) return [];
  return PLAN_OBJECTIVES[planKey].map((o) => ({
    ...o,
    itemKey: objectiveItemKey(planKey, o.key),
  }));
}

// ─── Marcador en la descripción de la tarea ─────────────────────────────────

const TEMPLATE_MARKER_RE = /\[plantilla:([a-z]+):([a-z0-9-]+)\]/;

/** `[plantilla:branding:logo]`. */
export function templateMarker(stage: StageKey, key: string): string {
  return `[plantilla:${stage}:${key}]`;
}

/** Etapa y clave del marcador (null si la descripción no lo trae). */
export function readTemplateMarker(
  description: string | null | undefined,
): { stage: string; key: string } | null {
  const m = TEMPLATE_MARKER_RE.exec(description ?? "");
  return m ? { stage: m[1], key: m[2] } : null;
}

/** Nota visible + marcador, para la descripción de la tarea creada. */
export function templateDescription(stage: StageKey, key: string): string {
  return `Tarea estándar del plan.\n\n${templateMarker(stage, key)}`;
}
