import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  getClientPanelContracts,
  getClientPanelFiles,
  getClientPanelPlan,
} from "@/lib/client-panel/panel.functions";
import { usePanelMode } from "./panelMode";

/** Las URLs firmadas duran 1 hora: la lista de archivos se renueva antes. */
const FILES_STALE_MS = 30 * 60 * 1000;

/**
 * Datos de Plan, Archivos y Legal del panel. Solo server functions que leen
 * con las RPC client_* (cliente fijo por user_client_id(), o vista previa
 * validada en servidor). Nunca tablas internas ni un id de cliente propio.
 */
function useKeys(section: string) {
  const { user } = useAuth();
  const { preview } = usePanelMode();
  return {
    preview,
    enabled: Boolean(user?.id),
    queryKey: ["client-panel", user?.id ?? "anon", preview ?? "self", section] as const,
    data: { data: preview ? { preview } : {} },
  };
}

export function usePanelPlan() {
  const k = useKeys("plan");
  const load = useServerFn(getClientPanelPlan);
  return useQuery({ queryKey: k.queryKey, enabled: k.enabled, queryFn: () => load(k.data) });
}

export function usePanelFiles() {
  const k = useKeys("files");
  const load = useServerFn(getClientPanelFiles);
  return useQuery({
    queryKey: k.queryKey,
    enabled: k.enabled,
    staleTime: FILES_STALE_MS,
    refetchInterval: FILES_STALE_MS,
    queryFn: () => load(k.data),
  });
}

export function usePanelContracts() {
  const k = useKeys("legal");
  const load = useServerFn(getClientPanelContracts);
  return useQuery({ queryKey: k.queryKey, enabled: k.enabled, queryFn: () => load(k.data) });
}
