import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import type { ProspectState, ProspectValues } from "@/lib/prospects/schema";

export type Prospect = Tables<"prospects">;

export const NO_PERMISSION = "No tienes permisos para esta acción";

const PROSPECT_COLUMNS =
  "id,org_id,nombre,rubro,comuna,web,instagram,email_publico,telefono_publico,fuente,estado," +
  "producto_sugerido,notas,ultimo_contacto,created_by,created_at,updated_at";

/** Errores de RLS/privilegios → mensaje de permisos; el resto, tal cual. */
export function writeError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) return NO_PERMISSION;
  return error.message;
}

export function prospectsKey(userId: string) {
  return ["prospects", userId] as const;
}

function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "anon";
}

export function useProspects() {
  const userId = useUserId();
  return useQuery({
    queryKey: prospectsKey(userId),
    enabled: userId !== "anon",
    queryFn: async (): Promise<Prospect[]> => {
      const { data, error } = await supabase
        .from("prospects")
        .select(PROSPECT_COLUMNS)
        .order("updated_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Prospect[];
    },
  });
}

async function getOrgId(): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_org");
  if (error || !data) throw new Error(error?.message ?? "No se pudo obtener la organización");
  return data as string;
}

/** Al pasar a "contactado" sin fecha registrada, se anota hoy como último contacto. */
function contactPatch(prev: Pick<Prospect, "ultimo_contacto">, estado: ProspectState) {
  if (estado === "contactado" && !prev.ultimo_contacto) return { estado, ultimo_contacto: new Date().toISOString() };
  return { estado };
}

interface MoveVars {
  prospect: Prospect;
  estado: ProspectState;
}

/** Cambia el estado con actualización optimista; revierte si falla o si no hay permisos. */
export function useMoveProspect() {
  const queryClient = useQueryClient();
  const key = prospectsKey(useUserId());
  return useMutation({
    // El parche se calcula con el prospecto previo (no con la caché ya actualizada en onMutate).
    mutationFn: async ({ prospect, estado }: MoveVars) => {
      const { data, error } = await supabase
        .from("prospects")
        .update(contactPatch(prospect, estado))
        .eq("id", prospect.id)
        .select("id");
      if (error) throw new Error(writeError(error));
      if (!data || data.length === 0) throw new Error(NO_PERMISSION);
    },
    onMutate: async ({ prospect, estado }: MoveVars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Prospect[]>(key);
      const patch = contactPatch(prospect, estado);
      queryClient.setQueryData<Prospect[]>(key, (list) =>
        list?.map((p) => (p.id === prospect.id ? { ...p, ...patch } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Crea (sin id) o actualiza (con id) un prospecto ya validado con zod. */
export function useSaveProspect() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = prospectsKey(user?.id ?? "anon");
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ProspectValues }) => {
      if (id) {
        const { data, error } = await supabase.from("prospects").update(values).eq("id", id).select("id");
        if (error) throw new Error(writeError(error));
        if (!data || data.length === 0) throw new Error(NO_PERMISSION);
        return id;
      }
      const orgId = await getOrgId();
      const { data, error } = await supabase
        .from("prospects")
        .insert({ ...values, org_id: orgId, created_by: user?.id ?? null })
        .select("id");
      if (error) throw new Error(writeError(error));
      if (!data || data.length === 0) throw new Error(NO_PERMISSION);
      return data[0].id;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

const INSERT_CHUNK = 100;

/** Inserta en lotes. Devuelve cuántos se insertaron y el error del primer lote fallido. */
export async function insertProspects(
  rows: readonly ProspectValues[],
  userId: string | null,
): Promise<{ inserted: number; error: string | null }> {
  const orgId = await getOrgId();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK).map((v) => ({ ...v, org_id: orgId, created_by: userId }));
    const { data, error } = await supabase.from("prospects").insert(chunk).select("id");
    if (error) return { inserted, error: writeError(error) };
    if (!data || data.length === 0) return { inserted, error: NO_PERMISSION };
    inserted += data.length;
  }
  return { inserted, error: null };
}

export function useInvalidateProspects() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return () => queryClient.invalidateQueries({ queryKey: prospectsKey(userId) });
}
