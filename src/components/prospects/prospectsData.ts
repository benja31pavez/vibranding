import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import type { ExistingProspect } from "@/lib/prospects/importOficina";
import type { ProspectState, ProspectValues, RevokeTargetState } from "@/lib/prospects/schema";

export type Prospect = Tables<"prospects">;

export const NO_PERMISSION = "No tienes permisos para esta acción";
export const BAJA_LOCKED =
  "No se guardó: el prospecto está dado de baja (no se puede volver a contactar) o no tienes permisos para esta acción.";

/**
 * "*": incluye las columnas de la v3 (client_id, no_contactar_hasta, baja_revocada_at)
 * cuando existen, sin romper la lectura si la migración aún no se aplicó.
 */
const PROSPECT_COLUMNS = "*";

export const FRIO_NEEDS_V3 =
  "El estado \"Frío\" requiere la migración v3 de la base de datos. Mientras tanto usa \"Perdido\".";

/** Errores de RLS/privilegios → mensaje de permisos; CHECK de estado sin 'frio' → aviso v3; el resto, tal cual. */
export function writeError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) return NO_PERMISSION;
  if (error.code === "23514" && /estado/i.test(error.message)) return FRIO_NEEDS_V3;
  return error.message;
}

/** La RPC (o la columna) aún no existe: la migración v3 no está aplicada. */
export function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
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

const MOVE_KEY = ["prospects", "move"] as const;

/**
 * Cambia el estado con actualización optimista. La baja es inviolable: el UPDATE lleva
 * `estado <> 'baja'`, así que 0 filas significa baja (o sin permisos).
 */
export function useMoveProspect() {
  const queryClient = useQueryClient();
  const key = prospectsKey(useUserId());
  return useMutation({
    mutationKey: MOVE_KEY,
    // El parche se calcula con el prospecto previo (no con la caché ya actualizada en onMutate).
    mutationFn: async ({ prospect, estado }: MoveVars) => {
      const { data, error } = await supabase
        .from("prospects")
        .update(contactPatch(prospect, estado))
        .eq("id", prospect.id)
        .neq("estado", "baja")
        .select("id");
      if (error) throw new Error(writeError(error));
      if (!data || data.length === 0) throw new Error(BAJA_LOCKED);
    },
    onMutate: async ({ prospect, estado }: MoveVars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const patch = contactPatch(prospect, estado);
      queryClient.setQueryData<Prospect[]>(key, (list) =>
        list?.map((p) => (p.id === prospect.id ? { ...p, ...patch } : p)),
      );
    },
    // Revierte solo el prospecto afectado (no pisa otros movimientos en curso).
    onError: (_err, { prospect }) => {
      queryClient.setQueryData<Prospect[]>(key, (list) => list?.map((p) => (p.id === prospect.id ? prospect : p)));
    },
    onSettled: () => {
      // Refrescar solo cuando termina el último movimiento en curso, para no deshacer los optimistas.
      if (queryClient.isMutating({ mutationKey: MOVE_KEY }) === 1) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Crea (sin id) o actualiza (con id) un prospecto ya validado con zod. */
export function useSaveProspect() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = prospectsKey(user?.id ?? "anon");
  return useMutation({
    /**
     * Un UPDATE que deja un estado distinto de baja lleva `estado <> 'baja'`: salir de baja
     * solo se hace con useRevokeBaja (revoke_prospect_baja; el trigger de la v3 lo exige).
     */
    mutationFn: async ({ id, values }: { id?: string; values: ProspectValues }) => {
      if (id) {
        let query = supabase.from("prospects").update(values).eq("id", id);
        if (values.estado !== "baja") query = query.neq("estado", "baja");
        const { data, error } = await query.select("id");
        if (error) throw new Error(writeError(error));
        if (!data || data.length === 0) throw new Error(values.estado === "baja" ? NO_PERMISSION : BAJA_LOCKED);
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

const LOOKUP_CHUNK = 50;

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Valor entre comillas para un filtro `or` de PostgREST, con comodines de ILIKE escapados. */
function quotedIlike(value: string): string {
  const literal = value.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `"${literal.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/**
 * Prospectos ya guardados que coinciden por correo o por nombre (sin distinguir mayúsculas)
 * con las filas a importar. Consulta la BD directamente: no depende de la lista cargada.
 */
export async function fetchExistingFor(rows: readonly ProspectValues[]): Promise<ExistingProspect[]> {
  const cols = "nombre,comuna,email_publico";
  const emails = [...new Set(rows.map((r) => r.email_publico).filter((e): e is string => Boolean(e)))];
  const names = [...new Set(rows.map((r) => r.nombre.trim()).filter(Boolean))];
  const queries = [
    ...chunks(emails, LOOKUP_CHUNK).map((part) => supabase.from("prospects").select(cols).in("email_publico", part)),
    ...chunks(names, LOOKUP_CHUNK).map((part) =>
      supabase.from("prospects").select(cols).or(part.map((n) => `nombre.ilike.${quotedIlike(n)}`).join(",")),
    ),
  ];
  const results = await Promise.all(queries);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`No se pudo revisar duplicados: ${failed.error.message}`);
  return results.flatMap((r) => (r.data ?? []) as ExistingProspect[]);
}

/** Revoca una baja (owner/admin) con motivo; vuelve al estado indicado. Ver revoke_prospect_baja (v3). */
export function useRevokeBaja() {
  const queryClient = useQueryClient();
  const key = prospectsKey(useUserId());
  return useMutation({
    mutationFn: async ({ id, motivo, estado }: { id: string; motivo: string; estado: RevokeTargetState }) => {
      const { error } = await supabase.rpc("revoke_prospect_baja", {
        _prospect_id: id,
        _motivo: motivo,
        _estado: estado,
      });
      if (error) {
        if (isMissingRpc(error)) throw new Error("Revocar una baja requiere la migración v3 de la base de datos.");
        throw new Error(writeError(error));
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** ¿El usuario es owner/admin de la org? (is_org_manager). Solo ellos pueden revocar una baja. */
export function useIsOrgManager(orgId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ["is-org-manager", userId, orgId],
    enabled: Boolean(orgId) && userId !== "anon",
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_org_manager", { _org_id: orgId as string });
      if (error) throw new Error(error.message);
      return data === true;
    },
  });
}
