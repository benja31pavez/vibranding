/**
 * "Pedir reseña": reglas y plantillas puras para pedirle a un cliente contento
 * una reseña de Google de Vibranding y, si quiere, un testimonio corto.
 *
 * - Sin E/S ni React: se prueba con scripts/check-reviews.mjs.
 * - Nunca envía nada: el dueño copia el mensaje o lo abre en WhatsApp/correo.
 * - Política de Google: nada a cambio de la reseña (sin descuentos, regalos ni
 *   beneficios) y sin pedir solo reseñas positivas. Tampoco urgencia falsa.
 */

// ------------------------------------------------------------------ umbrales

/** Días mínimos como cliente activo antes de sugerir pedir reseña. */
export const REVIEW_MIN_ACTIVE_DAYS = 60;
/** Como máximo una sugerencia por cliente cada N días. */
export const REVIEW_COOLDOWN_DAYS = 90;
/** Único estado de cliente en que se sugiere. */
export const REVIEW_CLIENT_STATUS = "activo";
/** Nivel de salud requerido (src/lib/health). */
export const REVIEW_HEALTH_LEVEL = "bien";
/** Motivo de salud que bloquea la sugerencia aunque el nivel fuera "bien". */
export const REVIEW_BLOCKING_REASON = "cobro_vencido";

// ------------------------------------------------------------------ textos

export const REVIEW_SUBJECT = "¿Nos ayudas con una reseña?";
export const REVIEW_GOOD_MOMENT_LABEL = "Buen momento para pedir reseña";
export const REVIEW_MISSING_URL_NOTICE =
  "Configura tu link de reseñas de Google (VITE_GOOGLE_REVIEW_URL)";

export const REVIEW_THANKS =
  "Quería agradecerte por la confianza en este tiempo trabajando juntos.";
export const REVIEW_GOOGLE_ASK =
  "Si te nace, ¿nos dejarías una reseña en Google contando cómo ha sido tu experiencia con Vibranding? Toma un par de minutos y nos ayuda mucho a que otras pymes nos conozcan.";
export const REVIEW_GOOGLE_LINK_LABEL = "Link para la reseña";
export const REVIEW_TESTIMONIAL_ASK =
  "Y si te animas, también nos serviría un testimonio corto (2 o 3 líneas) sobre cómo ha sido trabajar juntos, para mostrarlo en nuestra web. Solo lo publicamos con tu visto bueno.";
export const REVIEW_TESTIMONIAL_ONLY_ASK =
  "¿Te animarías a escribirnos un testimonio corto (2 o 3 líneas) sobre cómo ha sido trabajar juntos? Nos gustaría mostrarlo en nuestra web, siempre con tu visto bueno.";
export const REVIEW_NO_PRESSURE =
  "Lo que quieras contar, con total libertad. Y si no puedes, no te preocupes: igual feliz de seguir trabajando contigo.";

/** Todas las plantillas (para revisar redacción en el check). */
export const REVIEW_TEMPLATES: readonly string[] = [
  REVIEW_SUBJECT,
  REVIEW_THANKS,
  REVIEW_GOOGLE_ASK,
  REVIEW_TESTIMONIAL_ASK,
  REVIEW_TESTIMONIAL_ONLY_ASK,
  REVIEW_NO_PRESSURE,
];

// ------------------------------------------------------------------ link de Google

/** Link de reseñas válido (https) o null. */
export function normalizeReviewUrl(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ mensaje

export interface ReviewRequestInput {
  businessName: string;
  /** Nombre de la persona de contacto (se usa solo el primer nombre). */
  contactName?: string | null;
  /** Link de reseñas de Google; vacío/ inválido → solo se pide el testimonio. */
  googleReviewUrl?: string | null;
}

export interface ReviewRequest {
  subject: string;
  /** Cuerpo sin firma (la firma la agrega quien lo muestra). */
  body: string;
  /** false si no hay link de Google configurado: solo se pide el testimonio. */
  includesGoogle: boolean;
}

function greeting(businessName: string, contactName?: string | null): string {
  const first = (contactName ?? "").trim().split(/\s+/)[0];
  return first ? `Hola ${first}, ¿cómo estás?` : `Hola, equipo de ${businessName}, ¿cómo están?`;
}

/** Mensaje listo para revisar y enviar a mano. */
export function buildReviewRequest(input: ReviewRequestInput): ReviewRequest {
  const url = normalizeReviewUrl(input.googleReviewUrl);
  const parts = url
    ? [
        `${greeting(input.businessName, input.contactName)} ${REVIEW_THANKS}`,
        `${REVIEW_GOOGLE_ASK}\n\n${REVIEW_GOOGLE_LINK_LABEL}: ${url}`,
        REVIEW_TESTIMONIAL_ASK,
        REVIEW_NO_PRESSURE,
      ]
    : [
        `${greeting(input.businessName, input.contactName)} ${REVIEW_THANKS}`,
        REVIEW_TESTIMONIAL_ONLY_ASK,
        REVIEW_NO_PRESSURE,
      ];
  return { subject: REVIEW_SUBJECT, body: parts.join("\n\n"), includesGoogle: Boolean(url) };
}

// ------------------------------------------------------------------ fechas

const DAY_MS = 86_400_000;

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((ymdToUtc(b) - ymdToUtc(a)) / DAY_MS);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function ymdOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.slice(0, 10);
  return YMD.test(v) ? v : null;
}

// ------------------------------------------------------------------ cuándo sugerir

export interface ReviewMomentInput {
  clientStatus: string | null | undefined;
  /** clients.started_at (o created_at si no hay inicio). */
  startedAt: string | null | undefined;
  /** Nivel de salud (src/lib/health) o null si no se pudo calcular. */
  healthLevel: string | null | undefined;
  /** Códigos de motivos de salud abiertos. */
  healthReasonCodes?: readonly string[];
  /** ¿Tiene algún cobro vencido? */
  hasOverduePayments: boolean;
  /** Última vez (YYYY-MM-DD) que se pidió reseña a este cliente, o null. */
  lastAskedYmd: string | null | undefined;
  /** Hoy (YYYY-MM-DD, Chile). */
  today: string;
}

/** Días como cliente activo (null si no hay fecha válida). */
export function activeDays(startedAt: string | null | undefined, today: string): number | null {
  const start = ymdOf(startedAt);
  return start ? daysBetween(start, today) : null;
}

/** ¿Se pidió hace menos de REVIEW_COOLDOWN_DAYS? */
export function askedRecently(lastAskedYmd: string | null | undefined, today: string): boolean {
  const last = ymdOf(lastAskedYmd);
  return Boolean(last) && daysBetween(last as string, today) < REVIEW_COOLDOWN_DAYS;
}

/** Salud "bien" + activo ≥ 60 días + sin cobros vencidos + no pedido en 90 días. */
export function isGoodMomentForReview(input: ReviewMomentInput): boolean {
  if (input.clientStatus !== REVIEW_CLIENT_STATUS) return false;
  if (input.healthLevel !== REVIEW_HEALTH_LEVEL) return false;
  if (input.hasOverduePayments) return false;
  if ((input.healthReasonCodes ?? []).includes(REVIEW_BLOCKING_REASON)) return false;
  const days = activeDays(input.startedAt, input.today);
  if (days === null || days < REVIEW_MIN_ACTIVE_DAYS) return false;
  return !askedRecently(input.lastAskedYmd, input.today);
}

// ------------------------------------------------------------------ "ya se pidió" (localStorage)

/**
 * Registro de cuándo se pidió reseña a cada cliente. Es una PREFERENCIA DE ESTE
 * NAVEGADOR (como los "Marcar como hecho" de seguimientos), por usuario.
 */
export const REVIEW_ASKED_STORAGE_PREFIX = "vb:resenas:pedida";
/** Evento de ventana para que la ficha y "Inicio" se enteren al instante. */
export const REVIEW_ASKED_EVENT = "vb:resenas:pedida";

export function reviewAskedStorageKey(userId: string): string {
  return `${REVIEW_ASKED_STORAGE_PREFIX}:${userId}`;
}

/** clientId → fecha (YYYY-MM-DD) en que se pidió reseña. */
export type ReviewAskedMap = Readonly<Record<string, string>>;

/** Parsea lo guardado; descarta basura y entradas fuera de la ventana de 90 días. */
export function parseReviewAsked(raw: string | null, today: string): ReviewAskedMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, string] =>
          typeof e[1] === "string" && YMD.test(e[1]) && askedRecently(e[1], today),
      ),
    );
  } catch {
    return {};
  }
}

export function withReviewAsked(map: ReviewAskedMap, clientId: string, today: string): ReviewAskedMap {
  return { ...map, [clientId]: today };
}
