import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dashboardKeys } from "@/components/dashboard/queries";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ApprovalPermissionError,
  itemKey,
  toApprovalItems,
  type ApprovalItem,
  type InstagramDecision,
} from "@/lib/approvals";

/** Keys de React Query de la bandeja; acotadas por usuario para no mezclar sesiones. */
export const approvalKeys = {
  all: ["approvals"] as const,
  queue: (userId: string) => ["approvals", "queue", userId] as const,
};

/** Refresca la bandeja y el badge del header (llamar tras cambiar entregables, posts o propuestas). */
export function invalidateApprovalQueue(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: approvalKeys.all }),
    // Bloque "Aprobaciones" del dashboard: su key se acota por usuario, así que se compara por forma.
    queryClient.invalidateQueries({ predicate: (q) => isDashboardApprovalsKey(q.queryKey) }),
  ]);
}

const DASHBOARD_APPROVALS_SHAPE = dashboardKeys.approvals("");

function isDashboardApprovalsKey(key: readonly unknown[]): boolean {
  return (
    key.length === DASHBOARD_APPROVALS_SHAPE.length &&
    key[0] === DASHBOARD_APPROVALS_SHAPE[0] &&
    key[2] === DASHBOARD_APPROVALS_SHAPE[2]
  );
}

const REFRESH_MS = 60_000;

async function fetchApprovalQueue(): Promise<ApprovalItem[]> {
  const { data: rows, error } = await supabase
    .from("approval_queue")
    .select("org_id,client_id,kind,ref_id,title,created_at,url_hint");
  if (error) throw new Error(error.message);

  const clientIds = [...new Set((rows ?? []).flatMap((r) => (r.client_id ? [r.client_id] : [])))];
  if (clientIds.length === 0) return toApprovalItems(rows ?? [], new Map());

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id,name")
    .in("id", clientIds);
  if (clientsError) throw new Error(clientsError.message);
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  return toApprovalItems(rows ?? [], names);
}

function useQueueKey() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return { userId, queryKey: approvalKeys.queue(userId) };
}

/** Cola de aprobaciones pendientes (entregables, posts de Instagram y propuestas). */
export function useApprovalQueue() {
  const { userId, queryKey } = useQueueKey();
  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: fetchApprovalQueue,
    refetchInterval: REFRESH_MS,
  });
  return { ...query, items: query.data ?? [], count: query.data?.length ?? 0 };
}

/** Solo el conteo, para el badge del header. Comparte caché con useApprovalQueue. */
export function useApprovalCount(): number {
  const { userId, queryKey } = useQueueKey();
  const { data } = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: fetchApprovalQueue,
    refetchInterval: REFRESH_MS,
    select: (items) => items.length,
  });
  return data ?? 0;
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

export type ApprovalAction =
  | { type: "deliverable_approve"; item: ApprovalItem }
  | { type: "deliverable_changes"; item: ApprovalItem; note: string }
  | { type: "instagram_decision"; item: ApprovalItem; decision: InstagramDecision };

const SUCCESS_MESSAGE: Record<string, string> = {
  deliverable_approve: "Entregable aprobado",
  deliverable_changes: "Cambios solicitados",
  aprobado: "Post aprobado",
  cambios: "Se pidieron cambios al post",
  rechazado: "Post rechazado",
};

const DEFAULT_CHANGES_NOTE = "Se solicitaron cambios desde la bandeja de aprobaciones.";

interface Author {
  id: string;
  name: string;
}

/** Falla con ApprovalPermissionError si RLS no dejó actualizar ninguna fila. */
function assertUpdated(data: unknown[] | null) {
  if (!data || data.length === 0) throw new ApprovalPermissionError();
}

async function setDeliverableStatus(id: string, status: "done" | "in_progress") {
  const { data, error } = await supabase
    .from("deliverables")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  assertUpdated(data);
}

/** Deja constancia en el hilo del entregable, igual que DeliverablesList. */
async function addDeliverableComment(
  item: ApprovalItem,
  author: Author,
  kind: "approval" | "change_request",
  body: string,
) {
  if (!item.clientId) return;
  const { error } = await supabase.from("deliverable_comments").insert({
    deliverable_id: item.refId,
    client_id: item.clientId,
    author: "agency",
    author_role: "agency",
    author_user_id: author.id,
    author_name: author.name,
    read_by_agency: true,
    kind,
    body,
  });
  // El cambio de estado ya se aplicó: solo avisamos que el comentario no quedó registrado.
  if (error)
    toast.warning(`El estado cambió, pero no se pudo guardar el comentario: ${error.message}`);
}

async function decideInstagramPost(id: string, decision: InstagramDecision, authorId: string) {
  const approved = decision === "aprobado";
  const { data, error } = await supabase
    .from("instagram_posts")
    .update({
      approval_status: decision,
      approved_at: approved ? new Date().toISOString() : null,
      approved_by: approved ? authorId : null,
    })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  assertUpdated(data);
}

async function runAction(action: ApprovalAction, author: Author) {
  switch (action.type) {
    case "deliverable_approve":
      await setDeliverableStatus(action.item.refId, "done");
      await addDeliverableComment(action.item, author, "approval", "Aprobado ✓");
      return;
    case "deliverable_changes":
      await setDeliverableStatus(action.item.refId, "in_progress");
      await addDeliverableComment(
        action.item,
        author,
        "change_request",
        action.note.trim() || DEFAULT_CHANGES_NOTE,
      );
      return;
    case "instagram_decision":
      await decideInstagramPost(action.item.refId, action.decision, author.id);
      return;
  }
}

/** Mutación optimista: saca el ítem de la cola al instante y lo repone si falla. */
export function useApprovalAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { queryKey } = useQueueKey();

  return useMutation({
    mutationFn: (action: ApprovalAction) => {
      if (!user) throw new ApprovalPermissionError();
      const author: Author = {
        id: user.id,
        name: (user.user_metadata?.full_name as string | undefined) || user.email || "Agencia",
      };
      return runAction(action, author);
    },
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ApprovalItem[]>(queryKey);
      const removedKey = itemKey(action.item);
      queryClient.setQueryData<ApprovalItem[]>(queryKey, (items) =>
        items?.filter((i) => itemKey(i) !== removedKey),
      );
      return { previous };
    },
    onError: (error, _action, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(error instanceof Error ? error.message : "No se pudo completar la acción");
    },
    onSuccess: (_data, action) => {
      const key = action.type === "instagram_decision" ? action.decision : action.type;
      toast.success(SUCCESS_MESSAGE[key]);
    },
    onSettled: () => invalidateApprovalQueue(queryClient),
  });
}
