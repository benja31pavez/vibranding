/**
 * Datos del "Plan del mes": tareas ya existentes del cliente para ese mes y
 * la creación de las nuevas en `client_tasks` (tareas internas, estado pending).
 */
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agendaKeys } from "@/lib/agenda/agenda.queries";
import { invalidateApprovalQueue } from "@/hooks/use-approval-queue";
import { dashboardKeys } from "@/components/dashboard/queries";
import {
  cycleMarkerLike,
  isDuplicate,
  monthBounds,
  planMarker,
  withoutCycleOverlap,
  type ExistingTask,
  type MonthPlanItem,
} from "@/lib/delivery/monthPlan";
import { PERMISSION_DENIED_MSG, fichaKeys, writeErrorMessage } from "./fichaQueries";

/** Tope por consulta: un mes normal tiene ~30 tareas; sobra margen. */
const EXISTING_LIMIT = 500;

export const monthPlanKeys = {
  existing: (userId: string, clientId: string, month: string) =>
    ["month-plan", userId, clientId, month] as const,
};

/**
 * Tareas del mes (por fecha), las que tienen el marcador del plan del mes
 * (aunque se hayan movido de fecha) y las del ciclo mensual del Plan de ese mes.
 */
export async function fetchExistingTasks(clientId: string, month: string): Promise<ExistingTask[]> {
  const { first, last } = monthBounds(month);
  const markerPrefix = planMarker(month, "").slice(0, -1); // "[plan-mes:2026-11:"
  const columns = "id,title,due_date,description,status";
  const [byDate, byMarker, byCycle] = await Promise.all([
    supabase
      .from("client_tasks")
      .select(columns)
      .eq("client_id", clientId)
      .gte("due_date", first)
      .lte("due_date", last)
      .limit(EXISTING_LIMIT),
    supabase
      .from("client_tasks")
      .select(columns)
      .eq("client_id", clientId)
      .like("description", `%${markerPrefix}%`)
      .limit(EXISTING_LIMIT),
    supabase
      .from("client_tasks")
      .select(columns)
      .eq("client_id", clientId)
      .like("description", cycleMarkerLike(month))
      .limit(EXISTING_LIMIT),
  ]);
  const error = byDate.error ?? byMarker.error ?? byCycle.error;
  if (error) throw new Error(writeErrorMessage(error));
  const unique = new Map(
    [...(byDate.data ?? []), ...(byMarker.data ?? []), ...(byCycle.data ?? [])].map((t) => [
      t.id,
      t,
    ]),
  );
  return [...unique.values()].map(({ title, due_date, description, status }) => ({
    title,
    due_date,
    description,
    status,
  }));
}

export function useExistingMonthTasks(
  userKey: string,
  clientId: string,
  month: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: monthPlanKeys.existing(userKey, clientId, month),
    queryFn: () => fetchExistingTasks(clientId, month),
    enabled,
  });
}

export interface CreateResult {
  readonly created: number;
  readonly skipped: number;
}

/**
 * Crea las tareas elegidas. Vuelve a leer lo existente justo antes de insertar
 * para no duplicar si otra pestaña ya generó el plan.
 *
 * Riesgo residual aceptado: si dos pestañas confirman casi al mismo tiempo,
 * ambas pueden leer "no existe" antes de que la otra inserte y duplicar. No hay
 * índice único sobre el marcador (sería una migración); el marcador permite
 * detectar y borrar los duplicados a mano en Plan › Tareas.
 */
export async function createMonthTasks(
  clientId: string,
  month: string,
  items: readonly MonthPlanItem[],
): Promise<CreateResult> {
  const existing = await fetchExistingTasks(clientId, month);
  // Lo que ya cubre el ciclo mensual del Plan (calendario, piezas, reporte…) no se repite.
  const fresh = withoutCycleOverlap(items, month, existing).filter(
    (item) => !isDuplicate(item, month, existing),
  );
  if (fresh.length === 0) return { created: 0, skipped: items.length };

  const { data, error } = await supabase
    .from("client_tasks")
    .insert(
      fresh.map((item) => ({
        client_id: clientId,
        title: item.title.trim(),
        description: item.description,
        due_date: item.dueDate,
        status: "pending" as const,
      })),
    )
    .select("id");
  if (error) throw new Error(writeErrorMessage(error));
  if (!data || data.length === 0) throw new Error(PERMISSION_DENIED_MSG);
  if (data.length < fresh.length) {
    throw new Error(
      `Solo se crearon ${data.length} de ${fresh.length} tareas. Revisa la pestaña Tareas.`,
    );
  }
  return { created: data.length, skipped: items.length - fresh.length };
}

/** Refresca Agenda, Aprobaciones, salud, "Hoy" y la ficha tras crear tareas. */
export function invalidateAfterMonthPlan(
  queryClient: QueryClient,
  userKey: string,
  clientId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["month-plan", userKey, clientId] }),
    queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.operations(userKey) }),
    queryClient.invalidateQueries({ queryKey: fichaKeys.all(userKey, clientId) }),
    invalidateApprovalQueue(queryClient),
  ]);
}
