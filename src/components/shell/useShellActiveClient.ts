import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientSummary } from "./useClientList";
import { shellKeys } from "./shellQueries";

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
 * cliente abierto (localStorage). Usa React Query para refrescarse al invalidar ["shell"].
 */
export function useShellActiveClient(path: string, userId: string | undefined) {
  const navigate = useNavigate();
  const idFromUrl = path.match(CLIENT_ID_IN_PATH)?.[1] ?? null;
  const [storedId, setStoredId] = useState<string | null>(null);

  // localStorage solo existe en el cliente: se lee tras montar y cuando cambia la ruta.
  useEffect(() => {
    if (idFromUrl) {
      writeStoredId(idFromUrl);
      setStoredId(idFromUrl);
    } else {
      setStoredId(readStoredId());
    }
  }, [idFromUrl]);

  const targetId = idFromUrl ?? storedId;

  const { data, isSuccess, error } = useQuery({
    queryKey: shellKeys.client(userId ?? "", targetId ?? ""),
    enabled: Boolean(userId && targetId),
    queryFn: async (): Promise<ClientSummary | null> => {
      const { data: row, error: err } = await supabase
        .from("clients")
        .select("id,name,instagram_handle")
        .eq("id", targetId as string)
        .maybeSingle();
      if (err) throw new Error(err.message);
      return row;
    },
  });

  useEffect(() => {
    if (error) console.error("[shell] No se pudo cargar el cliente activo", error);
  }, [error]);

  // El cliente guardado ya no existe (borrado o sin acceso): olvidarlo.
  useEffect(() => {
    if (isSuccess && data === null && targetId) {
      writeStoredId(null);
      setStoredId(null);
    }
  }, [isSuccess, data, targetId]);

  const clearActive = useCallback(() => {
    writeStoredId(null);
    setStoredId(null);
    if (path.startsWith("/clients/")) navigate({ to: "/clients" });
  }, [navigate, path]);

  const activeClient = targetId && data ? data : null;
  return { activeClient, clearActive };
}
