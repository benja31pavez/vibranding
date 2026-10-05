/**
 * Zonas horarias IANA para la preferencia "Zona horaria" del perfil.
 * Solo afectan cómo ve las horas el usuario en su panel; las reglas de negocio
 * (cobros, vencimientos, feriados, cron, reportes, portal) siguen en hora de Chile.
 */

export const DEFAULT_TIME_ZONE = "America/Santiago";
/** Igual que el CHECK de la columna user_profiles.timezone. */
export const MAX_TIME_ZONE_LENGTH = 64;

const TIME_ZONE_RE = /^[A-Za-z0-9_+\-/]+$/;

/** Respaldo si el navegador no expone Intl.supportedValuesOf (Safari < 15.4, Node antiguos). */
const FALLBACK_TIME_ZONES: readonly string[] = [
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Asuncion",
  "America/Bogota",
  "America/Caracas",
  "America/Chicago",
  "America/Denver",
  "America/Guatemala",
  "America/Halifax",
  "America/La_Paz",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Montevideo",
  "America/New_York",
  "America/Panama",
  "America/Phoenix",
  "America/Punta_Arenas",
  "America/Santiago",
  "America/Santo_Domingo",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Kolkata",
  "Asia/Manila",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Atlantic/Azores",
  "Atlantic/Canary",
  "Atlantic/Reykjavik",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Indian/Maldives",
  "Pacific/Auckland",
  "Pacific/Easter",
  "Pacific/Honolulu",
  "UTC",
];

/** true si el texto es un identificador IANA que el motor de Intl reconoce. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.length > MAX_TIME_ZONE_LENGTH || !TIME_ZONE_RE.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Todas las zonas IANA del motor (o el respaldo), con Chile y UTC siempre presentes. */
export function listTimeZones(): string[] {
  let zones: readonly string[] = FALLBACK_TIME_ZONES;
  try {
    const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const all = supported?.("timeZone");
    if (all && all.length > 0) zones = all;
  } catch {
    // Motor sin soporte: se usa el respaldo.
  }
  const set = new Set([...zones, DEFAULT_TIME_ZONE, "UTC"]);
  return [...set].filter(isValidTimeZone).sort();
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = offsetFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
    offsetFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/** Desfase actual respecto de UTC: "UTC+2", "UTC-3", "UTC+5:30" o "UTC". */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const raw =
      offsetFormatter(timeZone)
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(raw);
    if (!m || (m[2] === "00" && m[3] === "00")) return "UTC";
    const hours = String(Number(m[2]));
    return `UTC${m[1]}${hours}${m[3] === "00" ? "" : `:${m[3]}`}`;
  } catch {
    return "UTC";
  }
}

/** Nombre legible: "Europe/Madrid (UTC+2)" (guiones bajos como espacios). */
export function timeZoneLabel(timeZone: string, at: Date = new Date()): string {
  return `${timeZone.replace(/_/g, " ")} (${utcOffsetLabel(timeZone, at)})`;
}

const REGION_LABEL: Readonly<Record<string, string>> = {
  America: "América",
  Europe: "Europa",
  Africa: "África",
  Asia: "Asia",
  Atlantic: "Atlántico",
  Australia: "Australia",
  Indian: "Índico",
  Pacific: "Pacífico",
  Antarctica: "Antártida",
  Arctic: "Ártico",
};
const REGION_ORDER = Object.keys(REGION_LABEL);
const OTHER_REGION = "Otras";

export interface TimeZoneOption {
  id: string;
  label: string;
}

export interface TimeZoneGroup {
  region: string;
  zones: TimeZoneOption[];
}

function regionKey(timeZone: string): string {
  const head = timeZone.split("/")[0];
  return head in REGION_LABEL ? head : OTHER_REGION;
}

/** Zonas agrupadas por región (América y Europa primero), cada una con su desfase actual. */
export function groupTimeZones(zones: readonly string[], at: Date = new Date()): TimeZoneGroup[] {
  const byRegion = new Map<string, TimeZoneOption[]>();
  for (const id of zones) {
    const key = regionKey(id);
    const list = byRegion.get(key) ?? [];
    byRegion.set(key, [...list, { id, label: timeZoneLabel(id, at) }]);
  }
  return [...REGION_ORDER, OTHER_REGION]
    .filter((key) => byRegion.has(key))
    .map((key) => ({ region: REGION_LABEL[key] ?? OTHER_REGION, zones: byRegion.get(key) ?? [] }));
}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_/]/g, " ").toLowerCase();

/** Filtro del buscador: cada palabra buscada debe aparecer (sin tildes ni mayúsculas). */
export function timeZoneSearchScore(value: string, search: string): number {
  const haystack = normalize(value);
  const words = normalize(search).split(/\s+/).filter(Boolean);
  return words.every((w) => haystack.includes(w)) ? 1 : 0;
}

/** Texto buscable de una zona: etiqueta, identificador y región en español. */
export function timeZoneSearchValue(option: TimeZoneOption, region: string): string {
  return `${option.label} ${option.id} ${region}`;
}
