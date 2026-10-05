import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isMissingColumnError } from "@/lib/portal/postNotes";

/** Nota que dejó un cliente desde el portal al aprobar o pedir cambios en un post. */
export interface PostFeedback {
  id: string;
  clientId: string;
  clientName: string;
  caption: string | null;
  approvalStatus: string | null;
  note: string;
  noteAt: string | null;
}

const FEEDBACK_LIMIT = 20;

/**
 * Cliente sin tipos de esquema: approval_note* no está en types.ts hasta que
 * se aplique la migración y se regeneren los tipos.
 */
const untyped = supabase as unknown as SupabaseClient;

type Row = {
  id: string;
  client_id: string;
  caption: string | null;
  approval_status: string | null;
  approval_note: string | null;
  approval_note_at: string | null;
  clients: { name: string } | null;
};

/**
 * Lee notas no leídas. Si la migración 20261012000300 aún no está aplicada
 * (columnas inexistentes) devuelve [] sin error: no hay nada que mostrar.
 */
async function fetchFeedback(clientId?: string): Promise<PostFeedback[]> {
  let q = untyped
    .from("instagram_posts")
    .select("id,client_id,caption,approval_status,approval_note,approval_note_at,clients(name)")
    .eq("approval_note_read", false)
    .order("approval_note_at", { ascending: false })
    .limit(FEEDBACK_LIMIT);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (isMissingColumnError(error)) return [];
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).flatMap((r) =>
    r.approval_note
      ? [
          {
            id: r.id,
            clientId: r.client_id,
            clientName: r.clients?.name ?? "Cliente",
            caption: r.caption,
            approvalStatus: r.approval_status,
            note: r.approval_note,
            noteAt: r.approval_note_at,
          },
        ]
      : [],
  );
}

export const postFeedbackKey = (userId: string, clientId?: string) =>
  ["post-feedback", userId, clientId ?? "all"] as const;

/** Notas de clientes en posts de Instagram aún no leídas por el equipo. */
export function usePostFeedback(clientId?: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: postFeedbackKey(userId, clientId),
    enabled: Boolean(userId),
    queryFn: () => fetchFeedback(clientId),
  });
}

/** Marca notas como leídas (políticas de agencia sobre instagram_posts). */
export async function markPostFeedbackRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await untyped
    .from("instagram_posts")
    .update({ approval_note_read: true })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
}
