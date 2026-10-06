/**
 * Plantillas del plan: tareas de inicio por etapa y objetivos estándar por plan.
 * (Las tareas que se repiten cada mes están en `./planCycle`.)
 *
 * Fuente única. Para cambiar un título, un responsable, el día, una meta o qué
 * señal de la plataforma marca una tarea como "Detectado ✓ — revisar", edita
 * solo `STAGE_CHECKLISTS` y `PLAN_OBJECTIVES`. Las claves (`key`) son estables:
 * si cambias una clave, para los clientes existentes es una tarea nueva (en
 * los objetivos, deja la anterior en `legacyKeys`).
 *
 * Al asignar el plan (o al abrir el Plan) se crean las que falten (ver
 * `./planTemplateSeed`). Cada tarea creada lleva el marcador
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

// ─── Tareas de inicio por etapa ─────────────────────────────────────────────

/** Ajustes de una tarea solo en un plan (título o día distinto). */
export interface ChecklistPlanOverride {
  readonly title?: string;
  readonly day?: number;
  readonly owner?: TeamMemberKey;
}

export interface ChecklistTask {
  /** Clave estable dentro de la etapa (minúsculas, números y guiones). */
  readonly key: string;
  readonly title: string;
  /** Responsable; sin valor, el de la etapa en el plan del cliente. */
  readonly owner?: TeamMemberKey;
  /**
   * Día relativo al inicio del cliente (1 = el día de inicio). La fecha cae en
   * el siguiente día hábil si ese día es fin de semana o feriado. Sin valor:
   * la tarea se crea sin fecha.
   */
  readonly day?: number;
  /** Título o día distinto según el plan. */
  readonly byPlan?: Partial<Readonly<Record<PlanKey, ChecklistPlanOverride>>>;
  /** Señal de la plataforma que la marca como "Detectado ✓ — revisar". */
  readonly signal?: PlanSignal;
  /** Solo en estos planes (sin valor: en todos los que tengan la etapa). */
  readonly plans?: readonly PlanKey[];
  /** Solo si el cliente publicita en esa plataforma (o aún no lo dijo). */
  readonly adsPlatform?: AdsPlatform;
}

/** Piezas al mes por plan (deben coincidir con `./monthPlan` y `./planCycle`). */
export const PIECES_PER_MONTH = { contenido: 12, crecimiento: 12, mantencion: 8 } as const;

/** Planes mensuales con etapa de Estrategia. */
const MONTHLY: readonly PlanKey[] = ["contenido", "crecimiento"];

/**
 * Tareas de INICIO de cada etapa: se crean una sola vez, al asignar el plan,
 * con responsable y fecha relativa al día de inicio del cliente. Lo que se
 * repite cada mes (calendario, piezas, aprobación, reporte…) vive en
 * `./planCycle` (`CYCLE_TASKS`). Antonia = diseño; Benjamín = estrategia,
 * copys, campañas, accesos, aprobaciones y reportes. Edita aquí.
 */
export const STAGE_CHECKLISTS: Readonly<Record<StageKey, readonly ChecklistTask[]>> = {
  estrategia: [
    {
      key: "brief",
      title: "Reunión de inicio y brief",
      owner: "benjamin",
      day: 1,
      signal: "intake_submitted",
      plans: MONTHLY,
    },
    {
      key: "publico",
      title: "Público objetivo y propuesta de valor",
      owner: "benjamin",
      day: 3,
      signal: "audience_defined",
      plans: MONTHLY,
    },
    {
      key: "accesos",
      title: "Accesos de Instagram, Meta y Google",
      owner: "benjamin",
      day: 3,
      plans: MONTHLY,
    },
    {
      key: "google-business",
      title: "Ficha de Google Business revisada",
      owner: "benjamin",
      day: 7,
      plans: ["contenido"],
    },
  ],
  branding: [
    {
      key: "brief",
      title: "Reunión de inicio y brief",
      owner: "benjamin",
      day: 1,
      signal: "intake_submitted",
      plans: ["marca-web"],
    },
    {
      key: "logo",
      title: "Logo en PNG y SVG",
      owner: "antonia",
      day: 5,
      signal: "logo_file",
      plans: ["crecimiento"],
    },
    {
      key: "propuesta-logo",
      title: "Propuesta de logo con 2 opciones",
      owner: "antonia",
      day: 5,
      plans: ["marca-web"],
    },
    {
      key: "paleta",
      title: "Paleta y tipografías",
      owner: "antonia",
      day: 5,
      signal: "brand_colors",
      plans: ["crecimiento"],
    },
    {
      key: "ajustes-logo",
      title: "Ajustes de logo",
      owner: "antonia",
      day: 8,
      plans: ["marca-web"],
    },
    {
      key: "kit",
      title: "Kit de marca entregado",
      owner: "antonia",
      day: 10,
      plans: ["marca-web"],
    },
  ],
  diseno: [
    {
      key: "logo",
      title: "Logo en PNG y SVG",
      owner: "antonia",
      day: 5,
      signal: "logo_file",
      plans: ["contenido"],
    },
    {
      key: "paleta",
      title: "Paleta y tipografías",
      owner: "antonia",
      day: 5,
      signal: "brand_colors",
      plans: ["contenido"],
    },
    {
      key: "instagram",
      title: "Bio, destacadas y link de Instagram",
      owner: "antonia",
      day: 7,
      plans: ["contenido"],
    },
  ],
  planificacion: [
    {
      key: "accesos",
      title: "Accesos de Instagram vigentes",
      owner: "benjamin",
      day: 1,
      plans: ["mantencion"],
    },
  ],
  // El trabajo de Contenido es mensual: ver `CYCLE_TASKS` en ./planCycle.
  contenido: [],
  ads: [
    {
      key: "pago",
      title: "Medio de pago de la pauta verificado",
      owner: "benjamin",
      day: 5,
      signal: "ads_billing_verified",
    },
    { key: "pixel", title: "Píxel y conversiones configurados", owner: "benjamin", day: 7 },
    {
      key: "publico-presupuesto",
      title: "Público y presupuesto aprobados",
      owner: "benjamin",
      day: 7,
    },
  ],
  landing: [
    {
      key: "borrador",
      title: "Borrador de landing",
      owner: "benjamin",
      day: 12,
      plans: ["marca-web"],
    },
    {
      key: "revision",
      title: "Revisión del cliente",
      owner: "benjamin",
      day: 14,
      plans: ["marca-web"],
    },
    // Landing en otros planes (Crecimiento o adicional).
    {
      key: "insumos",
      title: "Textos y fotos recibidos",
      owner: "benjamin",
      day: 7,
      signal: "client_files",
      plans: ["contenido", "crecimiento", "mantencion"],
    },
    {
      key: "url",
      title: "Dominio o URL definida",
      owner: "benjamin",
      day: 10,
      signal: "landing_url",
      plans: ["contenido", "crecimiento", "mantencion"],
    },
    {
      key: "publicada",
      title: "Landing publicada",
      owner: "benjamin",
      day: 14,
      signal: "landing_published",
      byPlan: {
        "marca-web": { title: "Landing publicada y probada", day: 16 },
      },
    },
    {
      key: "pruebas",
      title: "Botón de WhatsApp y formulario probados",
      owner: "benjamin",
      day: 15,
      signal: "landing_contact",
      plans: ["contenido", "crecimiento", "mantencion"],
    },
  ],
  // Adicional.
  chatbot: [
    { key: "faq", title: "Preguntas frecuentes recopiladas", owner: "benjamin", day: 7 },
    { key: "flujo", title: "Flujo aprobado", owner: "benjamin", day: 10 },
    { key: "whatsapp", title: "Número de WhatsApp conectado", owner: "benjamin", day: 12 },
    { key: "prueba", title: "Prueba completa", owner: "benjamin", day: 14 },
  ],
  optimizacion: [
    {
      key: "instagram",
      title: "Bio, destacadas y link de Instagram",
      owner: "antonia",
      day: 7,
      signal: "multilink_published",
    },
    {
      key: "google-business",
      title: "Ficha de Google Business revisada",
      owner: "benjamin",
      day: 7,
    },
  ],
  // El reporte es mensual: ver `CYCLE_TASKS` en ./planCycle.
  reporte: [],
  entrega: [
    {
      key: "google-business",
      title: "Ficha de Google Business",
      owner: "benjamin",
      day: 18,
      plans: ["marca-web"],
    },
    {
      key: "confirmacion",
      title: "Entrega final y confirmación",
      owner: "benjamin",
      day: 21,
    },
  ],
};

// ─── Objetivos estándar por plan ────────────────────────────────────────────

export type ObjectiveCategory = "growth" | "engagement" | "sales" | "branding" | "other";

/**
 * Objetivo estándar. Solo entregables del equipo (nada de % de crecimiento,
 * seguidores, interacción, CTR, leads ni costo por lead: eso depende del rubro).
 */
export interface ChecklistObjective {
  /** Clave estable dentro del plan. */
  readonly key: string;
  readonly title: string;
  /** Unidad de la métrica (se guarda en `objectives.unit`). */
  readonly metric: string;
  readonly category: ObjectiveCategory;
  /** Meta por defecto; null = sin meta numérica (se cumple o no). */
  readonly target: number | null;
  /**
   * Claves anteriores del mismo objetivo: si el cliente ya lo tiene (o lo
   * borró) con una de estas, no se vuelve a crear.
   */
  readonly legacyKeys?: readonly string[];
}

/** Horas máximas para que el cliente apruebe. */
export const APPROVAL_MAX_HOURS = 48;
/** Plazo de entrega del kit + landing (Marca + Web). */
export const MARCA_WEB_DELIVERY_LABEL = "2 a 3 semanas";
/** El reporte del mes se envía antes de este día del mes siguiente. */
export const REPORT_SENT_BEFORE_DAY = 5;
/** Anuncios nuevos al mes (Crecimiento). */
export const NEW_ADS_PER_MONTH = 4;

const PIECES_OBJECTIVE = (pieces: number): ChecklistObjective => ({
  key: "piezas-mes",
  title: `Publicar ${pieces} piezas al mes`,
  metric: "piezas",
  category: "engagement",
  target: pieces,
});

const REPORT_OBJECTIVE: ChecklistObjective = {
  key: "reporte-dia-5",
  title: `Reporte del mes enviado antes del día ${REPORT_SENT_BEFORE_DAY}`,
  metric: "reporte",
  category: "other",
  target: 1,
};

/** Objetivos estándar de cada plan. Edita aquí. */
export const PLAN_OBJECTIVES: Readonly<Record<PlanKey, readonly ChecklistObjective[]>> = {
  contenido: [
    PIECES_OBJECTIVE(PIECES_PER_MONTH.contenido),
    {
      key: "calendario-aprobado",
      title: "Calendario del mes aprobado",
      metric: "calendario",
      category: "other",
      target: 1,
    },
    {
      key: "aprobacion-48h",
      title: `Aprobación del cliente en ≤${APPROVAL_MAX_HOURS} h`,
      metric: "horas",
      category: "other",
      target: null,
    },
    REPORT_OBJECTIVE,
  ],
  crecimiento: [
    PIECES_OBJECTIVE(PIECES_PER_MONTH.crecimiento),
    {
      key: "anuncios-mes",
      title: "Anuncios nuevos al mes",
      metric: "anuncios",
      category: "growth",
      target: NEW_ADS_PER_MONTH,
    },
    {
      key: "campanas-activas",
      title: "Campañas activas todo el mes",
      metric: "campañas",
      category: "growth",
      target: null,
    },
    REPORT_OBJECTIVE,
  ],
  "marca-web": [
    {
      key: "entrega-kit-landing",
      title: `Entregar kit de marca y landing en ${MARCA_WEB_DELIVERY_LABEL}`,
      metric: "semanas",
      category: "branding",
      target: null,
      // Clave anterior (el plazo nunca fue 72 h; el título ya decía 2 a 3 semanas).
      legacyKeys: ["entrega-72h"],
    },
    {
      key: "google-business",
      title: "Ficha de Google Business completa",
      metric: "ficha",
      category: "branding",
      target: 1,
    },
    {
      key: "landing-contacto",
      title: "Landing con WhatsApp y formulario funcionando",
      metric: "landing",
      category: "sales",
      target: 1,
    },
  ],
  mantencion: [PIECES_OBJECTIVE(PIECES_PER_MONTH.mantencion), REPORT_OBJECTIVE],
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
  /** Día relativo al inicio del cliente (1 = día de inicio); null = sin fecha. */
  readonly day: number | null;
}

export interface PlannedObjective extends ChecklistObjective {
  /** "objetivo:<plan>:<clave>". */
  readonly itemKey: string;
  /** "objetivo:<plan>:<clave anterior>" (ver `legacyKeys`). */
  readonly legacyItemKeys: readonly string[];
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

/** Tareas de inicio del cliente, en el orden de sus etapas. */
export function checklistForPlan(ctx: ChecklistContext): PlannedTask[] {
  const planKey = ctx.planKey;
  if (!planKey) return [];
  return ctx.stages.flatMap((stage) =>
    STAGE_CHECKLISTS[stage.key]
      .filter((t) => includesTask(t, ctx))
      .map((t) => {
        const override = t.byPlan?.[planKey];
        return {
          itemKey: taskItemKey(stage.key, t.key),
          stage: stage.key,
          key: t.key,
          title: override?.title ?? t.title,
          owner: override?.owner ?? t.owner ?? stage.owner,
          signal: t.signal ?? null,
          day: override?.day ?? t.day ?? null,
        };
      }),
  );
}

/** Objetivos estándar del plan. */
export function objectivesForPlan(planKey: PlanKey | null): PlannedObjective[] {
  if (!planKey) return [];
  return PLAN_OBJECTIVES[planKey].map((o) => ({
    ...o,
    itemKey: objectiveItemKey(planKey, o.key),
    legacyItemKeys: (o.legacyKeys ?? []).map((k) => objectiveItemKey(planKey, k)),
  }));
}

// ─── Marcador en la descripción de la tarea ─────────────────────────────────

/**
 * `[plantilla:<etapa>:<clave>]` (tarea de inicio) o
 * `[plantilla:<etapa>:<clave>:<AAAA-MM>]` (tarea del ciclo mensual).
 */
const TEMPLATE_MARKER_RE = /\[plantilla:([a-z]+):([a-z0-9-]+)(?::(\d{4}-\d{2}))?\]/;

/** `[plantilla:branding:logo]`. */
export function templateMarker(stage: StageKey, key: string): string {
  return `[plantilla:${stage}:${key}]`;
}

export interface TemplateMarker {
  readonly stage: string;
  readonly key: string;
  /** Mes del ciclo ("AAAA-MM"); null en las tareas de inicio. */
  readonly month: string | null;
}

/** Etapa, clave y mes del marcador (null si la descripción no lo trae). */
export function readTemplateMarker(description: string | null | undefined): TemplateMarker | null {
  const m = TEMPLATE_MARKER_RE.exec(description ?? "");
  return m ? { stage: m[1], key: m[2], month: m[3] ?? null } : null;
}

/** Nota visible + marcador, para la descripción de la tarea creada. */
export function templateDescription(stage: StageKey, key: string): string {
  return `Tarea de inicio del plan.\n\n${templateMarker(stage, key)}`;
}
