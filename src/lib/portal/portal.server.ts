/**
 * Lecturas y escrituras del portal del cliente (solo servidor).
 *
 * Dos modos de acceso, mismo resultado:
 *  - "client": el usuario invitado del portal. Lee con SU sesión (RLS de
 *    user_client_id()). Excepción: instagram_posts no tiene policy de lectura
 *    para el portal, así que esos posts se leen con service role, filtrados
 *    por el client_id que devolvió user_client_id() y con columnas mínimas.
 *  - "preview": un miembro de la agencia mirando el portal de un cliente.
 *    Lee con SU sesión (RLS de agencia) y en modo solo lectura.
 *
 * Nunca se leen client_billing, notas internas ni MRR.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { todayInChile } from "@/lib/billing/dates";
import { periodRange } from "@/lib/reports/period";
import { isReportData } from "@/lib/reports/types";
import { isMissingColumnError } from "./postNotes";
import {
  DEFAULT_APPROVAL_NOTE,
  NOTE_MAX_LENGTH,
  pickKeyFigures,
  planLabel,
  splitPayments,
  toPortalPayments,
  type CalendarDeliverable,
  type CalendarPost,
  type DecisionResult,
  type PortalApprovals,
  type PortalBilling,
  type PortalCalendar,
  type PortalDecision,
  type PortalItemKind,
  type PortalProposal,
  type PortalReport,
  type PortalReviewComment,
  type PortalSnapshot,
  type RawPayment,
  type SectionResult,
} from "./model";

export type Db = SupabaseClient<Database>;

export interface PortalAccess {
  mode: "client" | "preview";
  clientId: string;
  /** Sesión del usuario (RLS). */
  db: Db;
}

const PROPOSALS_LIMIT = 10;
const PAYMENTS_LIMIT = 36;
const POSTS_PENDING_LIMIT = 30;
const CALENDAR_LIMIT = 200;
const VISIBLE_COMMENT_KINDS = ["comment", "approval", "change_request"] as const;
const VISIBLE_COMMENT_ROLES = ["agency", "client", "guest"] as const;
const POST_COLUMNS = "id,caption,format,image_url,cover_url,carousel_urls,scheduled_at";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/** Cliente para leer instagram_posts según el modo (ver comentario del archivo). */
async function postsDb(access: PortalAccess): Promise<Db> {
  return access.mode === "client" ? adminDb() : access.db;
}

/** Ejecuta una sección; si falla, registra el detalle y devuelve un mensaje amable. */
async function section<T>(
  name: string,
  clientId: string,
  run: () => Promise<T>,
): Promise<SectionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (e) {
    console.error(`[portal] sección ${name} falló`, {
      clientId,
      error: e instanceof Error ? e.message : e,
    });
    return { ok: false, error: "No pudimos cargar esta sección. Intenta de nuevo en un momento." };
  }
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/* ───────────────────────── Acceso ───────────────────────── */

/** Cliente del usuario del portal (null si no es usuario invitado de un cliente). */
export async function resolvePortalClientId(db: Db): Promise<string | null> {
  const { data, error } = await db.rpc("user_client_id");
  fail(error);
  return typeof data === "string" && data ? data : null;
}

/* ───────────────────────── Snapshot ───────────────────────── */

type PostRow = {
  id: string;
  caption: string | null;
  format: "photo" | "carousel" | "reel";
  image_url: string | null;
  cover_url: string | null;
  carousel_urls: string[] | null;
  scheduled_at: string | null;
};

function postImage(row: PostRow): string | null {
  return row.cover_url || row.image_url || row.carousel_urls?.[0] || null;
}

async function loadApprovals(access: PortalAccess): Promise<PortalApprovals> {
  const { db, clientId } = access;
  const [deliverablesRes, postsRes] = await Promise.all([
    db
      .from("deliverables")
      .select("id,title,description,type,due_date,file_url,file_name,mime_type")
      .eq("client_id", clientId)
      .eq("status", "in_review")
      .order("sort_order"),
    (await postsDb(access))
      .from("instagram_posts")
      .select(POST_COLUMNS)
      .eq("client_id", clientId)
      .eq("approval_status", "pendiente")
      .is("archived_at", null)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(POSTS_PENDING_LIMIT),
  ]);
  fail(deliverablesRes.error);
  fail(postsRes.error);

  const deliverables = deliverablesRes.data ?? [];
  const ids = deliverables.map((d) => d.id);
  const commentsByDeliverable = new Map<string, PortalReviewComment[]>();
  if (ids.length > 0) {
    const { data, error } = await db
      .from("deliverable_comments")
      .select("id,deliverable_id,kind,body,author_role,author_name,created_at")
      .eq("client_id", clientId)
      .in("deliverable_id", ids)
      // Solo tipos y autores conocidos y visibles para el cliente (nunca notas internas).
      .in("kind", [...VISIBLE_COMMENT_KINDS])
      .in("author_role", [...VISIBLE_COMMENT_ROLES])
      .order("created_at");
    fail(error);
    for (const c of data ?? []) {
      const comment: PortalReviewComment = {
        id: c.id,
        kind: c.kind as PortalReviewComment["kind"],
        body: c.body,
        authorRole: c.author_role as PortalReviewComment["authorRole"],
        authorName: c.author_name,
        createdAt: c.created_at,
      };
      commentsByDeliverable.set(c.deliverable_id, [
        ...(commentsByDeliverable.get(c.deliverable_id) ?? []),
        comment,
      ]);
    }
  }

  return {
    deliverables: deliverables.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      type: d.type,
      dueDate: d.due_date,
      fileUrl: d.file_url,
      fileName: d.file_name,
      mimeType: d.mime_type,
      comments: commentsByDeliverable.get(d.id) ?? [],
    })),
    posts: ((postsRes.data ?? []) as PostRow[]).map((p) => ({
      id: p.id,
      caption: p.caption,
      format: p.format,
      imageUrl: postImage(p),
      scheduledAt: p.scheduled_at,
    })),
  };
}

async function loadReport({ db, clientId }: PortalAccess): Promise<PortalReport | null> {
  const { data, error } = await db
    .from("monthly_reports")
    .select("period,token,summary,data")
    .eq("client_id", clientId)
    .not("sent_at", "is", null)
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  return {
    period: data.period,
    token: data.token,
    summary: data.summary,
    figures: isReportData(data.data) ? pickKeyFigures(data.data) : [],
  };
}

const PAYMENT_COLUMNS = "id,amount,currency,status,due_date,period,payment_url,document_type";

async function loadPaymentRows({ mode, db, clientId }: PortalAccess): Promise<RawPayment[]> {
  // El portal solo ve la vista con columnas seguras; la agencia lee las mismas columnas de payments.
  const query =
    mode === "client"
      ? db.from("portal_payments").select(PAYMENT_COLUMNS)
      : db.from("payments").select(PAYMENT_COLUMNS).eq("client_id", clientId);
  const { data, error } = await query.order("due_date", { ascending: false }).limit(PAYMENTS_LIMIT);
  fail(error);
  return (data ?? []) as RawPayment[];
}

async function loadBilling(access: PortalAccess): Promise<PortalBilling> {
  const [rows, subRes] = await Promise.all([
    loadPaymentRows(access),
    access.db
      .from("subscriptions")
      .select("plan_key,amount_clp,interval,next_charge_date")
      .eq("client_id", access.clientId)
      .eq("status", "activa")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  fail(subRes.error);
  const sub = subRes.data;
  return {
    plan: sub
      ? {
          label: planLabel(sub.plan_key),
          amountClp: sub.amount_clp,
          interval: sub.interval,
          nextChargeDate: sub.next_charge_date,
        }
      : null,
    ...splitPayments(toPortalPayments(rows, todayInChile())),
  };
}

async function loadProposals({ db, clientId }: PortalAccess): Promise<PortalProposal[]> {
  const { data, error } = await db
    .from("proposals")
    .select("id,title,plan_key,amount_clp,status,sent_at,expires_at,token,created_at")
    .eq("client_id", clientId)
    .neq("status", "borrador")
    .order("created_at", { ascending: false })
    .limit(PROPOSALS_LIMIT);
  fail(error);
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title?.trim() || `Propuesta ${planLabel(p.plan_key)}`,
    amountClp: p.amount_clp,
    status: p.status,
    sentAt: p.sent_at,
    expiresAt: p.expires_at,
    token: p.token,
  }));
}

export async function loadPortalSnapshot(access: PortalAccess): Promise<PortalSnapshot> {
  const { db, clientId } = access;
  const clientRes = await db.from("clients").select("name").eq("id", clientId).maybeSingle();
  if (clientRes.error) {
    console.error("[portal] no se pudo leer el cliente", {
      clientId,
      error: clientRes.error.message,
    });
    throw new Error("No pudimos cargar tu portal. Intenta de nuevo en un momento.");
  }

  const [approvals, report, billing, proposals] = await Promise.all([
    section("aprobaciones", clientId, () => loadApprovals(access)),
    section("resultados", clientId, () => loadReport(access)),
    section("pagos", clientId, () => loadBilling(access)),
    section("propuestas", clientId, () => loadProposals(access)),
  ]);
  return {
    clientId,
    clientName: clientRes.data?.name ?? "",
    approvals,
    report,
    billing,
    proposals,
  };
}

/* ───────────────────────── Calendario ───────────────────────── */

export async function loadPortalCalendar(
  access: PortalAccess,
  month: string,
): Promise<PortalCalendar> {
  const range = periodRange(month);
  const [postsRes, deliverablesRes] = await Promise.all([
    (await postsDb(access))
      .from("instagram_posts")
      .select("id,caption,format,scheduled_at,approval_status")
      .eq("client_id", access.clientId)
      .is("archived_at", null)
      .gte("scheduled_at", range.fromUtc)
      .lt("scheduled_at", range.toUtc)
      .order("scheduled_at")
      .limit(CALENDAR_LIMIT),
    access.db
      .from("deliverables")
      .select("id,title,status,type,due_date")
      .eq("client_id", access.clientId)
      .gte("due_date", range.firstDay)
      .lte("due_date", range.lastDay)
      .order("due_date")
      .limit(CALENDAR_LIMIT),
  ]);
  fail(postsRes.error);
  fail(deliverablesRes.error);

  const posts = (postsRes.data ?? []).flatMap((p): CalendarPost[] =>
    p.scheduled_at
      ? [
          {
            id: p.id,
            caption: p.caption,
            format: p.format,
            scheduledAt: p.scheduled_at,
            approvalStatus: p.approval_status,
          },
        ]
      : [],
  );
  const deliverables = (deliverablesRes.data ?? []).flatMap((d): CalendarDeliverable[] =>
    d.due_date
      ? [{ id: d.id, title: d.title, status: d.status, type: d.type, dueDate: d.due_date }]
      : [],
  );
  return { month, posts, deliverables };
}

/** Como máximo 20 decisiones por usuario por minuto (en memoria del Worker, best effort). */
const DECISIONS_PER_MINUTE = 20;
const MINUTE_MS = 60_000;
let decisionLimiter: { allow(key: string): boolean } | null = null;

export async function allowDecision(userId: string): Promise<boolean> {
  if (!decisionLimiter) {
    const { createRateLimiter } = await import("@/lib/security/ipRateLimit.server");
    decisionLimiter = createRateLimiter(DECISIONS_PER_MINUTE, MINUTE_MS);
  }
  return decisionLimiter.allow(`portal-decision:${userId}`);
}

/* ───────────────────────── Decisiones (solo modo client) ───────────────────────── */

export interface DecisionInput {
  kind: PortalItemKind;
  id: string;
  decision: PortalDecision;
  note: string;
}

export interface DecisionAuthor {
  userId: string;
  name: string;
}

/**
 * Comentario en el hilo del entregable con la sesión del cliente (policy
 * "client users comment own deliverables"). read_by_agency=false hace que
 * aparezca en las alertas de revisión del equipo.
 */
async function addClientComment(
  access: PortalAccess,
  author: DecisionAuthor,
  deliverableId: string,
  input: Pick<DecisionInput, "decision" | "note">,
): Promise<void> {
  const body = input.note.trim() || DEFAULT_APPROVAL_NOTE;
  const { error } = await access.db.from("deliverable_comments").insert({
    deliverable_id: deliverableId,
    client_id: access.clientId,
    author: "client",
    author_role: "client",
    author_user_id: author.userId,
    author_name: author.name,
    read_by_agency: false,
    kind: input.decision === "approve" ? "approval" : "change_request",
    body,
  });
  fail(error);
}

/** La decisión ya quedó guardada: si el comentario falla, se informa sin revertirla. */
async function tryAddClientComment(
  access: PortalAccess,
  author: DecisionAuthor,
  deliverableId: string,
  input: Pick<DecisionInput, "decision" | "note">,
): Promise<boolean> {
  try {
    await addClientComment(access, author, deliverableId, input);
    return true;
  } catch (e) {
    console.error("[portal] no se pudo registrar el comentario de la decisión", {
      clientId: access.clientId,
      deliverableId,
      error: e instanceof Error ? e.message : e,
    });
    return false;
  }
}

async function decideDeliverable(
  access: PortalAccess,
  author: DecisionAuthor,
  input: DecisionInput,
): Promise<DecisionResult> {
  const admin = await adminDb();
  // UPDATE condicional: solo si sigue en revisión y es de este cliente.
  const { data, error } = await admin
    .from("deliverables")
    .update({ status: input.decision === "approve" ? "done" : "in_progress" })
    .eq("id", input.id)
    .eq("client_id", access.clientId)
    .eq("status", "in_review")
    .select("id");
  fail(error);
  if (!data || data.length === 0) return { ok: false, reason: "stale" };
  return { ok: true, noteSaved: await tryAddClientComment(access, author, input.id, input) };
}

/**
 * Guarda la decisión del post (UPDATE condicional). Intenta incluir la nota
 * del cliente (approval_note*, migración 20261012000300); si las columnas aún
 * no existen, repite sin ellas. Devuelve null si el post ya no estaba pendiente.
 */
async function updatePostDecision(
  access: PortalAccess,
  author: DecisionAuthor,
  input: DecisionInput,
): Promise<{ noteStored: boolean } | null> {
  const admin = await adminDb();
  const approved = input.decision === "approve";
  const now = new Date().toISOString();
  const base = {
    approval_status: approved ? "aprobado" : "cambios",
    approved_at: approved ? now : null,
    // approved_by es uuid sin FK (platform_v2): guarda el usuario del portal que aprobó.
    approved_by: approved ? author.userId : null,
  };
  const withNote = {
    ...base,
    approval_note: (input.note.trim() || DEFAULT_APPROVAL_NOTE).slice(0, NOTE_MAX_LENGTH),
    approval_note_at: now,
    approval_note_read: false,
  };
  const run = (patch: Record<string, unknown>) =>
    admin
      .from("instagram_posts")
      .update(patch as never)
      .eq("id", input.id)
      .eq("client_id", access.clientId)
      .eq("approval_status", "pendiente")
      .is("archived_at", null)
      .select("id");

  let noteStored = true;
  let res = await run(withNote);
  if (isMissingColumnError(res.error)) {
    console.warn("[portal] columnas approval_note* no existen aún; decisión sin nota en el post");
    noteStored = false;
    res = await run(base);
  }
  fail(res.error);
  return res.data && res.data.length > 0 ? { noteStored } : null;
}

/** Entregable vinculado al post (para dejar la nota en su hilo). Errores → null. */
async function linkedDeliverableId(access: PortalAccess, postId: string): Promise<string | null> {
  const { data, error } = await access.db
    .from("deliverables")
    .select("id")
    .eq("client_id", access.clientId)
    .eq("instagram_post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[portal] no se pudo buscar el entregable vinculado", {
      clientId: access.clientId,
      postId,
      error: error.message,
    });
    return null;
  }
  return data?.id ?? null;
}

async function decidePost(
  access: PortalAccess,
  author: DecisionAuthor,
  input: DecisionInput,
): Promise<DecisionResult> {
  const saved = await updatePostDecision(access, author, input);
  if (!saved) return { ok: false, reason: "stale" };
  // La nota quedó en el post (y el equipo la ve como no leída): no duplicar el aviso.
  if (saved.noteStored) return { ok: true, noteSaved: true };

  // Sin la migración: aviso en el hilo del entregable vinculado, si existe.
  const linked = await linkedDeliverableId(access, input.id);
  if (!linked) {
    console.warn("[portal] post decidido sin entregable vinculado; la nota no queda registrada", {
      clientId: access.clientId,
      postId: input.id,
      decision: input.decision,
    });
    return { ok: true, noteSaved: false };
  }
  return { ok: true, noteSaved: await tryAddClientComment(access, author, linked, input) };
}

export function decidePortalItem(
  access: PortalAccess,
  author: DecisionAuthor,
  input: DecisionInput,
): Promise<DecisionResult> {
  if (access.mode !== "client") throw new Error("La vista previa es solo de lectura.");
  return input.kind === "deliverable"
    ? decideDeliverable(access, author, input)
    : decidePost(access, author, input);
}
