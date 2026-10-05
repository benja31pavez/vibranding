/**
 * Señales de la plataforma para las tareas estándar del plan ("ya está OK,
 * pero hay que revisar"). Lógica pura: recibe una foto de los datos del
 * cliente y dice qué señales de `PLAN_SIGNALS` se cumplen. Nunca completa una
 * tarea: la UI muestra "Detectado ✓ — revisar" y alguien la confirma.
 */
import type { AdsBillingState } from "@/lib/ads-billing/combined";
import { readTemplateMarker, STAGE_CHECKLISTS, type PlanSignal } from "./planChecklists";
import { isStageKey } from "./planStages";

export interface SignalSnapshot {
  /** Onboarding del cliente (null si no lo ha enviado). */
  readonly intake: {
    readonly publicoObjetivo: string | null;
    readonly colores: readonly string[];
    /** Rutas de Storage de los archivos subidos. */
    readonly archivos: readonly string[];
  } | null;
  readonly metaLinked: boolean;
  readonly googleLinked: boolean;
  /** Estado combinado del pago de pauta por plataforma (ver `ads-billing/combined`). */
  readonly adsBilling: readonly AdsBillingState[];
  readonly landings: readonly {
    readonly published: boolean;
    readonly slug: string | null;
    readonly whatsappEnabled: boolean;
    readonly contactEnabled: boolean;
  }[];
  readonly multilinks: readonly { readonly published: boolean }[];
  /** Reportes mensuales: `period` "AAAA-MM-01". */
  readonly reports: readonly { readonly period: string; readonly sentAt: string | null }[];
  /** Hoy ("AAAA-MM-DD", Chile). */
  readonly today: string;
}

/** Nombre de archivo que parece un logo (logo, logotipo, isotipo, imagotipo). */
const LOGO_NAME_RE = /(logo|isotipo|imagotipo)/;
const LOGO_EXT_RE = /\.(png|svg|pdf|webp|jpe?g)$/;

/** ¿Alguna ruta parece un archivo de logo? Mira solo el nombre, no la carpeta. */
export function hasLogoFile(paths: readonly string[]): boolean {
  return paths.some((path) => {
    const name = (path.split("/").pop() ?? "").toLowerCase();
    return LOGO_NAME_RE.test(name) && LOGO_EXT_RE.test(name);
  });
}

/** Primer día del mes anterior a `today` ("2026-10-05" → "2026-09-01"). */
export function previousMonthStart(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const y = month === 1 ? year - 1 : year;
  const m = month === 1 ? 12 : month - 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

const filled = (text: string | null | undefined) => Boolean(text && text.trim());

/** Señales que se cumplen con los datos actuales del cliente. */
export function detectSignals(s: SignalSnapshot): ReadonlySet<PlanSignal> {
  const recentFrom = previousMonthStart(s.today);
  const recent = s.reports.filter((r) => r.period >= recentFrom);
  const published = s.landings.filter((l) => l.published);
  const checks: Readonly<Record<PlanSignal, boolean>> = {
    intake_submitted: s.intake !== null,
    audience_defined: filled(s.intake?.publicoObjetivo),
    logo_file: hasLogoFile(s.intake?.archivos ?? []),
    brand_colors: (s.intake?.colores ?? []).some(filled),
    client_files: (s.intake?.archivos.length ?? 0) > 0,
    meta_linked: s.metaLinked,
    google_linked: s.googleLinked,
    ads_billing_verified: s.adsBilling.includes("verificado"),
    landing_published: published.length > 0,
    landing_contact: published.some((l) => l.whatsappEnabled && l.contactEnabled),
    landing_url: s.landings.some((l) => filled(l.slug)),
    multilink_published: s.multilinks.some((m) => m.published),
    report_generated: recent.length > 0,
    report_sent: recent.some((r) => filled(r.sentAt)),
  };
  return new Set((Object.keys(checks) as PlanSignal[]).filter((k) => checks[k]));
}

/** Señal de una tarea estándar según su marcador (null si no es de plantilla o no tiene). */
export function taskSignal(description: string | null | undefined): PlanSignal | null {
  const marker = readTemplateMarker(description);
  if (!marker || !isStageKey(marker.stage)) return null;
  return STAGE_CHECKLISTS[marker.stage].find((t) => t.key === marker.key)?.signal ?? null;
}

export interface DetectableTask {
  readonly status: string;
  readonly description: string | null;
}

/**
 * Señal detectada para una tarea abierta (null si ya está lista, si no es de
 * plantilla o si la señal no se cumple).
 */
export function detectedSignal(
  task: DetectableTask,
  signals: ReadonlySet<PlanSignal>,
): PlanSignal | null {
  if (task.status === "done" || task.status === "in_review") return null;
  const signal = taskSignal(task.description);
  return signal && signals.has(signal) ? signal : null;
}
