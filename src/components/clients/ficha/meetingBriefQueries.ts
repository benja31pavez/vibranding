import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_SIZE, type PageResult } from "@/lib/db/fetchAllRows";
import { addDaysYmd } from "@/lib/dates/chile";
import {
  BRIEF_APPROVAL_KINDS,
  briefWindows,
  type BriefListKey,
  type MeetingBriefInput,
} from "@/lib/briefing/meetingBrief";
import { useUserKey } from "./fichaQueries";

/**
 * Datos del "Resumen para reunión": consultas acotadas (columnas mínimas, por
 * cliente, por fecha y con límite) con la sesión del usuario (RLS).
 */

const STALE_MS = 2 * 60 * 1000;
const LIST_LIMIT = 200;
const APPROVALS_LIMIT = 50;
const PAYMENTS_LIMIT = 50;
const REPORTS_LIMIT = 12;
/**
 * Páginas máximas de insights por plataforma (60 días). Meta guarda una fila por
 * anuncio y día: 20 páginas ≈ 330 anuncios activos a diario. Al llegar al tope
 * no se muestran totales.
 */
const INSIGHT_PAGES = 20;

export const BRIEF_LOAD_ERROR = "No pudimos armar el resumen. Intenta de nuevo.";

export type BriefData = Omit<MeetingBriefInput, "clientName" | "today" | "health" | "healthError">;

type QueryResult<T> = { data: T | null; error: { message: string } | null };

/** Pagina con orden estable hasta una página incompleta o INSIGHT_PAGES (truncated). */
async function fetchCapped<T>(page: (from: number, to: number) => PageResult<T>) {
  const rows: T[] = [];
  for (let i = 0; i < INSIGHT_PAGES; i += 1) {
    const from = i * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

function must<T>(res: QueryResult<T>): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Lista pedida con `limit + 1`: devuelve hasta `limit` filas y si había más. */
function bounded<T>(res: QueryResult<T[]>, limit: number) {
  const rows = must(res) ?? [];
  return { rows: rows.slice(0, limit), partial: rows.length > limit };
}

async function loadBriefData(clientId: string, today: string): Promise<BriefData> {
  const w = briefWindows(today);
  // Márgenes en UTC alrededor de los días de Chile; el armado filtra exacto en hora de Chile.
  const since = `${addDaysYmd(w.from, -1)}T00:00:00Z`;
  const until = `${addDaysYmd(w.nextTo, 1)}T12:00:00Z`;

  const [deliverables, posts, tasks, reports, approvals, payments, intake, meta, google] =
    await Promise.all([
      supabase
        .from("deliverables")
        .select("title,type,status,updated_at,due_date")
        .eq("client_id", clientId)
        .or(
          `and(status.eq.done,updated_at.gte.${since}),and(status.neq.done,due_date.lte.${w.nextTo})`,
        )
        .order("updated_at", { ascending: false })
        .limit(LIST_LIMIT + 1),
      supabase
        .from("instagram_posts")
        .select("approved_at,published_at,scheduled_at")
        .eq("client_id", clientId)
        .is("archived_at", null)
        .or(
          `published_at.gte.${since},approved_at.gte.${since},and(scheduled_at.gte.${since},scheduled_at.lte.${until})`,
        )
        .order("updated_at", { ascending: false })
        .limit(LIST_LIMIT + 1),
      supabase
        .from("client_tasks")
        .select("title,status,due_date,updated_at")
        .eq("client_id", clientId)
        .or(
          `and(status.eq.done,updated_at.gte.${since}),and(status.neq.done,due_date.lte.${w.nextTo})`,
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(LIST_LIMIT + 1),
      supabase
        .from("monthly_reports")
        .select("sent_at")
        .eq("client_id", clientId)
        .gte("sent_at", since)
        .limit(REPORTS_LIMIT + 1),
      supabase
        .from("approval_queue")
        .select("kind,title,created_at")
        .eq("client_id", clientId)
        .in("kind", [...BRIEF_APPROVAL_KINDS])
        .order("created_at", { ascending: true })
        .limit(APPROVALS_LIMIT + 1),
      supabase
        .from("payments")
        .select("amount,currency,status,due_date")
        .eq("client_id", clientId)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(PAYMENTS_LIMIT + 1),
      supabase.from("client_intake").select("client_id").eq("client_id", clientId).maybeSingle(),
      // La sincronización de Meta escribe solo filas por anuncio (level = 'ad'); se suman en el armado.
      fetchCapped((from, to) =>
        supabase
          .from("ad_insights_daily")
          .select("date,spend,currency,messaging_conversations_started")
          .eq("client_id", clientId)
          .eq("level", "ad")
          .gte("date", w.prevFrom)
          .lte("date", today)
          .order("date", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      fetchCapped((from, to) =>
        supabase
          .from("google_ads_insights_daily")
          .select("date,cost_clp,conversions")
          .eq("client_id", clientId)
          .gte("date", w.prevFrom)
          .lte("date", today)
          .order("date", { ascending: false })
          .order("id")
          .range(from, to),
      ),
    ]);

  const lists = {
    deliverables: bounded(deliverables, LIST_LIMIT),
    posts: bounded(posts, LIST_LIMIT),
    tasks: bounded(tasks, LIST_LIMIT),
    reports: bounded(reports, REPORTS_LIMIT),
    approvals: bounded(approvals, APPROVALS_LIMIT),
    payments: bounded(payments, PAYMENTS_LIMIT),
  };
  const partialLists = (Object.keys(lists) as BriefListKey[]).filter((k) => lists[k].partial);

  return {
    deliverables: lists.deliverables.rows,
    posts: lists.posts.rows,
    tasks: lists.tasks.rows,
    reports: lists.reports.rows,
    approvals: lists.approvals.rows,
    payments: lists.payments.rows.map((p) => ({ ...p, amount: Number(p.amount) })),
    intakeSubmitted: Boolean(must(intake)),
    meta: meta.rows,
    google: google.rows,
    campaignsPartial: { meta: meta.truncated, google: google.truncated },
    partialLists,
  };
}

/** Datos del resumen; solo se consulta mientras el diálogo está abierto. */
export function useMeetingBriefData(clientId: string, today: string, enabled: boolean) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["ficha", userKey, clientId, "meeting-brief", today] as const,
    enabled,
    staleTime: STALE_MS,
    queryFn: async () => {
      try {
        return await loadBriefData(clientId, today);
      } catch (e) {
        console.error("[resumen] error al cargar datos del resumen", { clientId, error: e });
        throw new Error(BRIEF_LOAD_ERROR);
      }
    },
  });
}
