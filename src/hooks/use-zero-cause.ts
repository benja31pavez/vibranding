import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSetupStatus } from "@/lib/meta/setup.functions";

/**
 * Turns "no data" into "no data *because*": every empty chart in Analítica and
 * en Qué funciona names its own cause instead of showing a blank panel.
 */
export function useZeroCause(clientId: string) {
  const fetchStatus = useServerFn(getSetupStatus);
  const { data } = useQuery({
    queryKey: ["setup-status", clientId],
    queryFn: () => fetchStatus({ data: { clientId } }),
    staleTime: 60_000,
  });

  const a = data?.account ?? null;
  const ig = data?.instagram ?? null;

  const spendReason = (() => {
    if (!a || !a.connected) {
      return "No hay una cuenta de Meta conectada para este cliente, así que no hay inversión que mostrar.";
    }
    if (!a.ad_account_id) {
      return "La conexión de Meta no tiene una cuenta publicitaria asignada, así que no hay inversión que traer.";
    }
    if (!a.last_ingest_at) {
      return "La ingesta de anuncios nunca se ha ejecutado para este cliente. Ejecútala desde Conexiones en el panel del cliente.";
    }
    if (a.last_ingest_reason) return a.last_ingest_reason;
    if (a.last_sync_error)
      return `Meta devolvió un error en la última sincronización: ${a.last_sync_error}`;
    return "La última ingesta terminó bien pero no había gasto en este rango. Prueba otro periodo.";
  })();

  const mediaReason = (() => {
    if (!a || !a.connected) {
      return "No hay una cuenta de Meta/Instagram conectada para este cliente, así que no existen métricas reales que analizar.";
    }
    if (!a.ig_account_id) {
      return "La conexión de Meta no tiene una cuenta de Instagram vinculada, así que no hay contenido que medir.";
    }
    if (!ig?.syncedAt) {
      return "Instagram está vinculado pero todavía no se ha sincronizado el perfil ni las publicaciones reales.";
    }
    return "La cuenta de Instagram no registró métricas de contenido en este periodo. Amplía el rango o sincroniza Instagram.";
  })();

  return { status: data ?? null, spendReason, mediaReason };
}
