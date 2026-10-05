import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientSummary } from "./useClientList";
import { shellKeys } from "./shellQueries";
import {
  readStoredClientId,
  useStoredActiveClientId,
  writeStoredClientId,
} from "./activeClientStore";

const CLIENT_ID_IN_PATH = /^\/clients\/([0-9a-f-]{36})/i;

/**
 * Cliente activo del panel izquierdo: se toma de la URL (/clients/:id) o del último
 * cliente abierto (localStorage). Usa React Query para refrescarse al invalidar ["shell"].
 */
export function useShellActiveClient(path: string, userId: string | undefined) {
  const idFromUrl = path.match(CLIENT_ID_IN_PATH)?.[1] ?? null;
  // localStorage solo existe en el cliente: el hook lo lee tras montar y al cambiar.
  const storedId = useStoredActiveClientId();

  // Abrir la ficha de un cliente lo deja como activo.
  useEffect(() => {
    if (idFromUrl && readStoredClientId() !== idFromUrl) writeStoredClientId(idFromUrl);
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
      writeStoredClientId(null);
    }
  }, [isSuccess, data, targetId]);

  const activeClient = targetId && data ? data : null;
  return { activeClient };
}
