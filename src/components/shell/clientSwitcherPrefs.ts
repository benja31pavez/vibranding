/**
 * Preferencias locales del pop-up "Cambiar de cliente": clientes fijados y recientes.
 * Viven en localStorage por usuario (no son datos del cliente, solo comodidad de navegación).
 */
const PINNED_KEY = "vibranding:clientes-fijados";
const RECENT_KEY = "vibranding:clientes-recientes";
const MAX_RECENT = 6;

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // localStorage puede no estar disponible (modo privado); se ignora.
  }
}

export function readPinned(): string[] {
  return read(PINNED_KEY);
}

export function togglePinned(id: string): string[] {
  const current = readPinned();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  write(PINNED_KEY, next);
  return next;
}

export function readRecent(): string[] {
  return read(RECENT_KEY);
}

/** Registra una visita: el cliente pasa al frente de "Recientes". */
export function pushRecent(id: string): string[] {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
  return next;
}
