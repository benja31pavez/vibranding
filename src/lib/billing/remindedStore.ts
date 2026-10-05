/**
 * Lectura/escritura de "Recordado hoy" en localStorage (por usuario).
 * Si el navegador no lo permite (modo privado), no se marca nada y la app sigue.
 */
import { parseReminded, remindedStorageKey, type RemindedMap } from "@/lib/billing/reminders";

export function readReminded(today: string, userId: string): RemindedMap {
  if (!userId) return {};
  try {
    return parseReminded(window.localStorage.getItem(remindedStorageKey(userId)), today);
  } catch (e) {
    console.warn("[cobros] localStorage no disponible; no se marcará 'Recordado hoy'", e);
    return {};
  }
}

/** Guarda el mapa; devuelve false si el navegador no lo permite. */
export function writeReminded(map: RemindedMap, userId: string): boolean {
  if (!userId) return false;
  try {
    window.localStorage.setItem(remindedStorageKey(userId), JSON.stringify(map));
    return true;
  } catch (e) {
    console.warn("[cobros] no se pudo guardar 'Recordado hoy'", e);
    return false;
  }
}
