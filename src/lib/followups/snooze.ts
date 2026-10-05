/**
 * "Marcar como hecho" para seguimientos que no son prospectos (propuestas, cobros,
 * onboarding, reportes): se ocultan hasta mañana (hora de Chile).
 *
 * Es una PREFERENCIA DE ESTE NAVEGADOR (localStorage), no un registro en la BD:
 * no se comparte con otros dispositivos ni usuarios, se pierde al borrar datos del
 * sitio y, si el almacenamiento no está disponible (modo privado), simplemente no
 * se oculta nada. Mañana el ítem vuelve a aparecer si la condición sigue vigente.
 */

export const SNOOZE_STORAGE_PREFIX = "vb:followups:hecho-hoy";

/** Clave por usuario: en un navegador compartido cada cuenta tiene sus propios ocultos. */
export function snoozeStorageKey(userId: string): string {
  return `${SNOOZE_STORAGE_PREFIX}:${userId}`;
}

/** id del seguimiento → fecha (YYYY-MM-DD, Chile) en que se marcó como hecho. */
export type SnoozeMap = Readonly<Record<string, string>>;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Parsea lo guardado; descarta basura y entradas de días anteriores. */
export function parseSnoozes(raw: string | null, today: string): SnoozeMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === "string" && YMD.test(e[1]) && e[1] === today,
      ),
    );
  } catch {
    return {};
  }
}

export function isSnoozed(map: SnoozeMap, id: string, today: string): boolean {
  return map[id] === today;
}

export function withSnooze(map: SnoozeMap, id: string, today: string): SnoozeMap {
  return { ...map, [id]: today };
}

export function readSnoozes(today: string, userId: string): SnoozeMap {
  try {
    return parseSnoozes(window.localStorage.getItem(snoozeStorageKey(userId)), today);
  } catch (e) {
    console.warn("[seguimientos] localStorage no disponible; no se ocultarán ítems", e);
    return {};
  }
}

/** Guarda el mapa; devuelve false si el navegador no lo permite. */
export function writeSnoozes(map: SnoozeMap, userId: string): boolean {
  try {
    window.localStorage.setItem(snoozeStorageKey(userId), JSON.stringify(map));
    return true;
  } catch (e) {
    console.warn("[seguimientos] no se pudo guardar en localStorage", e);
    return false;
  }
}
