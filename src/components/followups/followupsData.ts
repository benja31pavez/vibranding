import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { addDaysYmd, chileToday } from "@/lib/dates/chile";
import {
  THRESHOLDS,
  closedPeriod,
  computeFollowups,
  type ProspectInput,
} from "@/lib/followups/rules";
import type { Followup } from "@/lib/followups/types";
import { NO_PERMISSION, prospectsKey, writeError } from "@/components/prospects/prospectsData";
import { BAJA_NOTICE } from "@/lib/prospects/schema";

/**
 * Datos de "Seguimientos sugeridos". Una sola query (compartida por "Hoy" y las
 * fichas) lee lo mínimo de cada tabla visible por RLS y aplica las reglas puras
 * de src/lib/followups/rules.ts. No escribe nada salvo "Marcar como hecho" en prospectos.
 */

const REFRESH_MS = 10 * 60 * 1000;

export const followupsKey = (userId: string) => ["followups", userId] as const;

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const PROSPECT_BASE_COLUMNS =
  "id,nombre,estado,ultimo_contacto,updated_at,telefono_publico,producto_sugerido";
/** Columnas de la migración v3 (pueden no existir todavía). */
const PROSPECT_V3_COLUMNS = "no_contactar_hasta,client_id";
const UNDEFINED_COLUMN = "42703";
/** Tope de ids por filtro `in` para no exceder el largo de URL de PostgREST. */
const IN_CHUNK = 100;

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Prospectos con solo las columnas necesarias; si la v3 no está aplicada, sin sus columnas. */
async function loadProspects(): Promise<ProspectInput[]> {
  const page = (columns: string) => (from: number, to: number) =>
    supabase.from("prospects").select(columns).order("id").range(from, to);
  try {
    return await fetchAllRowsWithCode<ProspectInput>(
      page(`${PROSPECT_BASE_COLUMNS},${PROSPECT_V3_COLUMNS}`),
    );
  } catch (e) {
    if (!(e instanceof ColumnMissingError)) throw e;
    console.warn(
      "[seguimientos] columnas v3 de prospects no disponibles; se omite no_contactar_hasta",
    );
    return fetchAllRowsWithCode<ProspectInput>(page(PROSPECT_BASE_COLUMNS));
  }
}

class ColumnMissingError extends Error {}

/** Como fetchAllRows, pero distingue "columna inexistente" (42703) para poder reintentar. */
async function fetchAllRowsWithCode<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
): Promise<T[]> {
  return fetchAllRows<T>(async (from, to) => {
    const { data, error } = await page(from, to);
    if (error?.code === UNDEFINED_COLUMN) throw new ColumnMissingError(error.message);
    return { data: (data ?? null) as T[] | null, error };
  });
}

/** Filas de `table` cuyos `column` están en `ids`, en lotes. */
async function loadByIds<T>(
  ids: readonly string[],
  query: (part: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const results = await Promise.all(chunks(ids, IN_CHUNK).map((part) => query(part)));
  const failed = results.find((r) => r.error);
  fail(failed?.error ?? null);
  return results.flatMap((r) => r.data ?? []);
}

async function loadSources() {
  // `today` se recalcula en cada refetch (la query se refresca cada REFRESH_MS).
  const today = chileToday();
  const dueLimit = addDaysYmd(today, THRESHOLDS.paymentDueSoonDays);
  const [proposals, prospects, payments, billing, reports] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("proposals")
        .select(
          "id,status,sent_at,viewed_at,expires_at,token,title,amount_clp,plan_key,client_id,prospect_id",
        )
        .in("status", ["enviada", "vista"])
        .order("id")
        .range(from, to),
    ),
    loadProspects(),
    fetchAllRows((from, to) =>
      supabase
        .from("payments")
        .select("id,client_id,amount,currency,due_date,status,payment_url,description")
        .or(`status.eq.overdue,and(status.eq.pending,due_date.lte.${dueLimit})`)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("client_billing")
        .select("client_id,plan_key,onboarding_token,onboarding_token_expires_at")
        .not("onboarding_token", "is", null)
        .order("client_id")
        .range(from, to),
    ),
    supabase
      .from("monthly_reports")
      .select("id,client_id,period,token,sent_at")
      .eq("period", closedPeriod(today))
      .is("sent_at", null)
      .then((r) => {
        fail(r.error);
        return r.data ?? [];
      }),
  ]);

  // Solo los clientes que aparecen en algún seguimiento posible.
  const clientIds = [
    ...new Set(
      [
        ...proposals.map((p) => p.client_id),
        ...payments.map((p) => p.client_id),
        ...billing.map((b) => b.client_id),
        ...reports.map((r) => r.client_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const [clients, intakes] = await Promise.all([
    loadByIds(clientIds, (part) =>
      supabase.from("clients").select("id,name,status,created_at,started_at").in("id", part),
    ),
    loadByIds(clientIds, (part) =>
      supabase.from("client_intake").select("client_id,contacto_telefono").in("client_id", part),
    ),
  ]);

  return {
    proposals: proposals.map((p) => ({ ...p, amount_clp: Number(p.amount_clp) })),
    prospects,
    payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    clients,
    billing,
    intakes,
    reports,
  };
}

export function useFollowups() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: followupsKey(userId),
    enabled: Boolean(userId),
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<Followup[]> => computeFollowups(await loadSources(), new Date()),
  });
}

/**
 * Registra el contacto con un prospecto: prospects.ultimo_contacto = ahora.
 * El UPDATE lleva `estado <> 'baja'`; 0 filas = baja o sin permisos (RLS).
 */
/** 0 filas actualizadas: distingue baja, sin permiso de edición y no existe/sin acceso. */
async function zeroRowsReason(prospectId: string): Promise<string> {
  const { data, error } = await supabase
    .from("prospects")
    .select("estado")
    .eq("id", prospectId)
    .maybeSingle();
  if (error) return writeError(error);
  if (!data) return "No se encontró el prospecto o no tienes acceso a él.";
  if (data.estado === "baja") return BAJA_NOTICE;
  return NO_PERMISSION;
}

export function useRecordProspectContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useMutation({
    /** Devuelve el instante registrado (para sincronizar formularios abiertos). */
    mutationFn: async (prospectId: string): Promise<string> => {
      const contactedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("prospects")
        .update({ ultimo_contacto: contactedAt })
        .eq("id", prospectId)
        .neq("estado", "baja")
        .select("id");
      if (error) throw new Error(writeError(error));
      if (!data || data.length === 0) throw new Error(await zeroRowsReason(prospectId));
      return contactedAt;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: followupsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: prospectsKey(userId || "anon") });
    },
  });
}
