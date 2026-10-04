import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { ClientSummary } from "./useClientList";

const STORAGE_KEY = "activeClientId";
const CLIENT_ID_IN_PATH = /^\/clients\/([0-9a-f-]{36})/i;

function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Almacenamiento bloqueado (modo privado): el cliente activo solo vive en memoria.
  }
}

/**
 * Cliente activo del panel izquierdo: se toma de la URL (/clients/:id) o del último
 * cliente abierto (localStorage).
 */
export function useShellActiveClient(path: string, enabled: boolean) {
  const navigate = useNavigate();
  const [activeClient, setActiveClient] = useState<ClientSummary | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const idFromUrl = path.match(CLIENT_ID_IN_PATH)?.[1];
    const targetId = idFromUrl || readStoredId();
    if (!targetId) {
      setActiveClient(null);
      return;
    }
    if (activeClient?.id === targetId) return;
    let cancelled = false;
    supabase
      .from("clients")
      .select("id,name,instagram_handle")
      .eq("id", targetId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[shell] No se pudo cargar el cliente activo", error);
          return;
        }
        if (data) {
          setActiveClient(data);
          if (idFromUrl) writeStoredId(data.id);
        } else {
          setActiveClient(null);
          writeStoredId(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);

  const clearActive = useCallback(() => {
    setActiveClient(null);
    writeStoredId(null);
    if (path.startsWith("/clients/")) navigate({ to: "/clients" });
  }, [navigate, path]);

  return { activeClient, clearActive };
}
