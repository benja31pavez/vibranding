import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { dashboardKeys } from "@/components/dashboard/queries";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ApprovalPermissionError,
  ApprovalStaleError,
  itemKey,
  restoreItem,
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

/** Opciones compartidas por la bandeja y el badge: misma key, misma caché. */
export function approvalQueueOptions(userId: string) {
  return queryOptions({
    queryKey: approvalKeys.queue(userId),
    enabled: Boolean(userId),
    queryFn: fetchApprovalQueue,
    refetchInterval: REFRESH_MS,
  });
}

function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
}

/** Cola de aprobaciones pendientes (entregables, posts de Instagram y propuestas). */
export function useApprovalQueue() {
  const query = useQuery(approvalQueueOptions(useUserId()));
  return { ...query, items: query.data ?? [], count: query.data?.length ?? 0 };
}

/** Solo el conteo, para el badge del header. */
export function useApprovalCount(): number {
  const { data } = useQuery({
    ...approvalQueueOptions(useUserId()),
    select: (items: ApprovalItem[]) => items.length,
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

export const approvalActionKey = ["approvals", "action"] as const;

interface Author {
  id: string;
  name: string;
}

/** Resultado de una acción aplicada: el comentario del entregable es secundario y puede fallar. */
interface ActionResult {
  commentError: string | null;
}

/**
 * 0 filas actualizadas: se vuelve a leer el registro para distinguir
 * "otro ya lo resolvió" (stale) de "RLS no te deja" (permisos).
 */
async function explainNoRows(stillPending: () => Promise<boolean>): Promise<never> {
  throw (await stillPending()) ? new ApprovalPermissionError() : new ApprovalStaleError();
}

async function deliverableStillPending(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("deliverables")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status === "in_review";
}

async function postStillPending(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("instagram_posts")
    .select("approval_status,archived_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.approval_status === "pendiente" && data.archived_at === null;
}

/** Solo actualiza si sigue "in_review" (mismo criterio que la vista approval_queue). */
async function setDeliverableStatus(id: string, status: "done" | "in_progress") {
  const { data, error } = await supabase
    .from("deliverables")
    .update({ status })
    .eq("id", id)
    .eq("status", "in_review")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) await explainNoRows(() => deliverableStillPending(id));
}

/** Deja constancia en el hilo del entregable, igual que DeliverablesList. */
async function addDeliverableComment(
  item: ApprovalItem,
  author: Author,
  kind: "approval" | "change_request",
  body: string,
): Promise<ActionResult> {
  if (!item.clientId) return { commentError: null };
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
  return { commentError: error?.message ?? null };
}

/** Solo actualiza si sigue "pendiente" y sin archivar (mismo criterio que approval_queue). */
async function decideInstagramPost(
  id: string,
  decision: InstagramDecision,
  authorId: string,
): Promise<ActionResult> {
  const approved = decision === "aprobado";
  const { data, error } = await supabase
    .from("instagram_posts")
    .update({
      approval_status: decision,
      approved_at: approved ? new Date().toISOString() : null,
      approved_by: approved ? authorId : null,
    })
    .eq("id", id)
    .eq("approval_status", "pendiente")
    .is("archived_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) await explainNoRows(() => postStillPending(id));
  return { commentError: null };
}

async function runAction(action: ApprovalAction, author: Author): Promise<ActionResult> {
  switch (action.type) {
    case "deliverable_approve":
      await setDeliverableStatus(action.item.refId, "done");
      return addDeliverableComment(action.item, author, "approval", "Aprobado ✓");
    case "deliverable_changes":
      await setDeliverableStatus(action.item.refId, "in_progress");
      return addDeliverableComment(
        action.item,
        author,
        "change_request",
        action.note.trim() || DEFAULT_CHANGES_NOTE,
      );
    case "instagram_decision":
      return decideInstagramPost(action.item.refId, action.decision, author.id);
  }
}

/**
 * Mutación optimista: saca el ítem de la cola al instante.
 * Si falla, repone solo ese ítem (salvo que ya lo haya resuelto otro).
 */
export function useApprovalAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = approvalKeys.queue(user?.id ?? "");

  return useMutation({
    mutationKey: approvalActionKey,
    mutationFn: (action: ApprovalAction): Promise<ActionResult> => {
      if (!user) throw new ApprovalPermissionError();
      const author: Author = {
        id: user.id,
        name: (user.user_metadata?.full_name as string | undefined) || user.email || "Agencia",
      };
      return runAction(action, author);
    },
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey });
      const removedKey = itemKey(action.item);
      queryClient.setQueryData<ApprovalItem[]>(queryKey, (items) =>
        items?.filter((i) => itemKey(i) !== removedKey),
      );
    },
    onError: (error, action) => {
      if (error instanceof ApprovalStaleError) {
        toast.info(error.message);
        return;
      }
      queryClient.setQueryData<ApprovalItem[]>(queryKey, (items) =>
        items ? restoreItem(items, action.item) : items,
      );
      toast.error(error instanceof Error ? error.message : "No se pudo completar la acción");
    },
    onSuccess: (result, action) => {
      if (result.commentError) {
        toast.warning(
          `El estado cambió, pero no se pudo guardar el comentario: ${result.commentError}`,
        );
        return;
      }
      const key = action.type === "instagram_decision" ? action.decision : action.type;
      toast.success(SUCCESS_MESSAGE[key]);
    },
    onSettled: () => {
      // Con varias acciones en vuelo, solo la última refresca (evita repintar ítems ya quitados).
      if (queryClient.isMutating({ mutationKey: approvalActionKey }) === 1) {
        return invalidateApprovalQueue(queryClient);
      }
    },
  });
}
