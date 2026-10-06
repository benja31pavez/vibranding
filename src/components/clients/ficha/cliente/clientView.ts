/**
 * Lógica pura de la ficha del cliente: qué eventos de la línea de tiempo puede
 * ver el cliente y el resumen de publicaciones del mes. Sin E/S ni React.
 */
import { monthName } from "@/lib/delivery/planCycle";
import { chileStamp, type TimelineEvent, type TimelineKind } from "../timeline";

/** Lo que el cliente ve de la actividad: sin propuestas, mensajes, cambios ni planes. */
export const CLIENT_TIMELINE_KINDS: ReadonlySet<TimelineKind> = new Set<TimelineKind>([
  "pago",
  "aprobacion",
  "contrato",
  "reporte",
  "onboarding",
  "archivo",
  "publicacion",
]);

export interface MonthPost {
  id: string;
  caption: string | null;
  image_url: string | null;
  cover_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  archived_at?: string | null;
}

const SNIPPET_CHARS = 70;

function snippet(text: string | null): string | null {
  const clean = text?.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > SNIPPET_CHARS ? `${clean.slice(0, SNIPPET_CHARS)}…` : clean;
}

/** "AAAA-MM" en Chile de un instante (null si no es válido). */
export function chileMonthOf(value: string | null): string | null {
  return value ? (chileStamp(value)?.ymd.slice(0, 7) ?? null) : null;
}

/** Eventos visibles para el cliente + posts publicados, del más nuevo al más antiguo. */
export function clientTimeline(
  events: readonly TimelineEvent[],
  posts: readonly MonthPost[],
): TimelineEvent[] {
  const published: TimelineEvent[] = posts.flatMap((p) =>
    p.published_at && !p.archived_at
      ? [
          {
            id: `published-${p.id}`,
            kind: "publicacion" as const,
            at: p.published_at,
            title: "Post publicado",
            detail: snippet(p.caption),
            by: null,
          },
        ]
      : [],
  );
  const visible = events.filter((e) => CLIENT_TIMELINE_KINDS.has(e.kind));
  return [...visible, ...published]
    .map((e) => ({ e, key: chileStamp(e.at)?.key ?? "" }))
    .filter(({ key }) => key !== "")
    .sort((a, b) => (a.key === b.key ? a.e.id.localeCompare(b.e.id) : a.key < b.key ? 1 : -1))
    .map(({ e }) => e);
}

export interface MonthSummary {
  /** Publicados en el mes, el más reciente primero. */
  published: MonthPost[];
  /** Próximo post programado (desde ahora), si hay. */
  next: MonthPost | null;
  /** Piezas del mes: publicadas o programadas dentro del mes. */
  pieces: number;
}

/** Publicaciones del mes ("AAAA-MM", hora de Chile) a partir de los posts del cliente. */
export function monthSummary(
  posts: readonly MonthPost[],
  month: string,
  now: Date = new Date(),
): MonthSummary {
  const live = posts.filter((p) => !p.archived_at);
  const published = live
    .filter((p) => chileMonthOf(p.published_at) === month)
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const upcoming = live
    .filter((p) => !p.published_at && p.scheduled_at && Date.parse(p.scheduled_at) >= now.getTime())
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const pieces = live.filter(
    (p) => chileMonthOf(p.published_at) === month || chileMonthOf(p.scheduled_at) === month,
  ).length;
  return { published, next: upcoming[0] ?? null, pieces };
}

/** Mes anterior a "AAAA-MM". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Color CSS válido para la paleta (hex, rgb, nombre…); null si no se puede pintar. */
export function paintableColor(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null;
  }
  return CSS.supports("color", v) ? v : null;
}

/** "2026-09-01" → "septiembre" (con año solo si no es el de `today`, "AAAA-MM-DD"). */
export function shortPeriod(period: string, today: string): string {
  const name = monthName(period.slice(0, 7));
  return period.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${period.slice(0, 4)}`;
}
