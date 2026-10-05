import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { chileToday } from "@/lib/dates/chile";
import { GOOGLE_REVIEW_URL } from "@/lib/site";
import { REVIEW_CLIENT_STATUS } from "@/lib/reviews/requestReview";
import { reviewFollowups, type ReviewCandidate } from "@/lib/followups/reviewSuggestions";
import type { Followup } from "@/lib/followups/types";
import { useReviewAsked } from "./reviewAsked";

/**
 * Datos de "Pedir reseña": clientes activos, su teléfono y quiénes tienen cobros
 * vencidos. Solo lectura (RLS). "Inicio" lee todos los activos; la ficha, solo
 * su cliente.
 */

const STALE_MS = 5 * 60 * 1000;
const IN_CHUNK = 100;

export const reviewCandidatesKey = (userId: string, clientId: string | null) =>
  ["review-candidates", userId, clientId] as const;

const CLIENT_COLUMNS = "id,name,status,created_at,started_at";

export interface ReviewCandidatesData {
  candidates: ReviewCandidate[];
  overdueClientIds: Set<string>;
}

function chunks<T>(list: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );
}

async function loadClients(clientId: string | null) {
  if (clientId) {
    const { data, error } = await supabase
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("id", clientId)
      .eq("status", REVIEW_CLIENT_STATUS);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return fetchAllRows((from, to) =>
    supabase
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("status", REVIEW_CLIENT_STATUS)
      .order("id")
      .range(from, to),
  );
}

async function loadCandidates(clientId: string | null): Promise<ReviewCandidatesData> {
  const today = chileToday();
  const clients = await loadClients(clientId);
  const ids = clients.map((c) => c.id);
  const parts = chunks(ids, IN_CHUNK);
  const [intakes, overdue] = await Promise.all([
    Promise.all(
      parts.map((part) =>
        supabase.from("client_intake").select("client_id,contacto_telefono").in("client_id", part),
      ),
    ),
    Promise.all(
      parts.map((part) =>
        supabase
          .from("payments")
          .select("client_id")
          .in("client_id", part)
          .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`),
      ),
    ),
  ]);
  const failed = [...intakes, ...overdue].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const phoneById = new Map(
    intakes.flatMap((r) => r.data ?? []).map((i) => [i.client_id, i.contacto_telefono]),
  );
  return {
    candidates: clients.map((c) => ({ ...c, phone: phoneById.get(c.id)?.trim() || null })),
    overdueClientIds: new Set(overdue.flatMap((r) => r.data ?? []).map((p) => p.client_id)),
  };
}

/** Sin `clientId`: todos los activos ("Inicio"). Con `clientId`: solo ese cliente (ficha). */
export function useReviewCandidates(options: { clientId?: string | null; enabled?: boolean } = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const clientId = options.clientId ?? null;
  return useQuery({
    queryKey: reviewCandidatesKey(userId, clientId),
    enabled: Boolean(userId) && (options.enabled ?? true),
    staleTime: STALE_MS,
    queryFn: () => loadCandidates(clientId),
  });
}

/**
 * Sugerencias "pedir_resena" para "Inicio". Si algo falla se devuelve [] y se
 * registra en consola: es una sugerencia opcional y no debe tapar los seguimientos.
 */
export function useReviewFollowups(enabled: boolean): Followup[] {
  const candidates = useReviewCandidates({ enabled });
  const { asked, today } = useReviewAsked();

  useEffect(() => {
    if (candidates.error)
      console.warn("[reseñas] no se pudieron leer los clientes", candidates.error);
  }, [candidates.error]);

  return useMemo(() => {
    if (!enabled || !candidates.data) return [];
    return reviewFollowups({
      candidates: candidates.data.candidates,
      overdueClientIds: candidates.data.overdueClientIds,
      asked,
      today,
      googleReviewUrl: GOOGLE_REVIEW_URL,
    });
  }, [enabled, candidates.data, asked, today]);
}
