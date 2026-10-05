import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateShellClients } from "@/components/shell/shellQueries";
import { PERMISSION_DENIED_MSG, fichaKeys, useUserKey, writeErrorMessage } from "./fichaQueries";

type Result = { ok: true } | { ok: false; error: string };

const MAX_NAME_LENGTH = 120;
const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

/** Renombrar (nombre + @handle) y eliminar un cliente. Detecta 0 filas como falta de permisos. */
export function useClientActions(clientId: string, reloadClient: () => Promise<void>) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userKey = useUserKey();

  const renameClient = async (name: string, handle: string): Promise<Result> => {
    const cleanName = name.trim();
    const cleanHandle = normalizeHandle(handle);
    if (!cleanName) return { ok: false, error: "El nombre no puede quedar vacío." };
    if (cleanName.length > MAX_NAME_LENGTH)
      return { ok: false, error: "El nombre es demasiado largo." };
    if (cleanHandle && !HANDLE_PATTERN.test(cleanHandle)) {
      return {
        ok: false,
        error: "El usuario de Instagram solo admite letras, números, puntos y guiones bajos.",
      };
    }
    const { data, error } = await supabase
      .from("clients")
      .update({ name: cleanName, instagram_handle: cleanHandle || null })
      .eq("id", clientId)
      .select("id");
    if (error) return { ok: false, error: writeErrorMessage(error) };
    if (!data || data.length === 0) return { ok: false, error: PERMISSION_DENIED_MSG };
    await reloadClient();
    void invalidateShellClients(queryClient);
    return { ok: true };
  };

  const deleteClient = async (): Promise<Result> => {
    const { data, error } = await supabase.from("clients").delete().eq("id", clientId).select("id");
    if (error) return { ok: false, error: writeErrorMessage(error) };
    if (!data || data.length === 0)
      return { ok: false, error: "No tienes permisos para eliminar este cliente." };
    queryClient.removeQueries({ queryKey: fichaKeys.all(userKey, clientId) });
    queryClient.removeQueries({ queryKey: fichaKeys.exists(userKey, clientId) });
    try {
      localStorage.removeItem("activeClientId");
    } catch {
      // Almacenamiento no disponible (modo privado): no afecta el borrado.
    }
    void invalidateShellClients(queryClient);
    void navigate({ to: "/clients" });
    return { ok: true };
  };

  return { renameClient, deleteClient };
}
