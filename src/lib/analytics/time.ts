/** Días calendario en America/Santiago (con horario de verano) para agrupar eventos. */

export const STATS_TIME_ZONE = "America/Santiago";
const DAY_MS = 86_400_000;

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: STATS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" del instante en hora de Santiago. */
export function santiagoDayKey(date: Date | string | number): string {
  return DAY_KEY.format(new Date(date));
}

/**
 * Los últimos `days` días calendario de Santiago, del más antiguo a hoy.
 * Se recorre por pasos de 12 h para no saltar ni repetir días en los cambios
 * de horario.
 */
export function santiagoDayRange(days: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  let t = now.getTime();
  while (keys.length < days) {
    const key = santiagoDayKey(t);
    if (keys[0] !== key) keys.unshift(key);
    t -= DAY_MS / 2;
  }
  return keys;
}

/**
 * Instante seguro desde el cual pedir filas a la BD para cubrir `days` días de
 * Santiago (un día de margen; luego se filtra exacto por santiagoDayKey).
 */
export function fetchSinceIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - (days + 1) * DAY_MS).toISOString();
}
