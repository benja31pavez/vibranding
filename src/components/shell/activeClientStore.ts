import { useEffect, useState } from "react";

/**
 * Cliente activo del panel izquierdo guardado en el navegador (último cliente abierto).
 * Cualquier cambio emite ACTIVE_CLIENT_EVENT para que el shell y otras pantallas
 * (p. ej. Clientes) se enteren sin recargar.
 */
const STORAGE_KEY = "activeClientId";
export const ACTIVE_CLIENT_EVENT = "active-client-changed";

export function readStoredClientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredClientId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Almacenamiento bloqueado (modo privado): el cliente activo solo vive en memoria.
  }
  window.dispatchEvent(new Event(ACTIVE_CLIENT_EVENT));
}

/** Desconecta el cliente activo: el panel izquierdo vuelve a "Seleccionar cliente". */
export function disconnectActiveClient() {
  writeStoredClientId(null);
}

/** Id del cliente activo guardado; se actualiza con ACTIVE_CLIENT_EVENT y entre pestañas. */
export function useStoredActiveClientId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setId(readStoredClientId());
    sync();
    window.addEventListener(ACTIVE_CLIENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACTIVE_CLIENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return id;
}
