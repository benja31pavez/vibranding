import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_SIZE, type PageResult } from "@/lib/db/fetchAllRows";
import { addDaysYmd } from "@/lib/dates/chile";
import { briefWindows, type MeetingBriefInput } from "@/lib/briefing/meetingBrief";
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
/** Páginas máximas de insights por plataforma; al alcanzarlas no se muestran totales. */
const INSIGHT_PAGES = 3;

export const BRIEF_LOAD_ERROR = "No pudimos armar el resumen. Intenta de nuevo.";

export type BriefData = Omit<MeetingBriefInput, "clientName" | "today" | "health">;

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

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

async function loadBriefData(clientId: string, today: string): Promise<BriefData> {
  const w = briefWindows(today);
  // Un día de margen hacia atrás: los timestamps se filtran exacto (hora de Chile) en el armado.
  const since = `${addDaysYmd(w.from, -1)}T00:00:00Z`;
  const insightsFrom = w.prevFrom;

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
        .limit(LIST_LIMIT),
      supabase
        .from("instagram_posts")
        .select("approved_at,published_at,scheduled_at")
        .eq("client_id", clientId)
        .is("archived_at", null)
        .or(
          `published_at.gte.${since},approved_at.gte.${since},and(scheduled_at.gte.${since},scheduled_at.lte.${w.nextTo}T23:59:59Z)`,
        )
        .limit(LIST_LIMIT),
      supabase
        .from("client_tasks")
        .select("title,status,due_date,updated_at")
        .eq("client_id", clientId)
        .or(
          `and(status.eq.done,updated_at.gte.${since}),and(status.neq.done,due_date.lte.${w.nextTo})`,
        )
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(LIST_LIMIT),
      supabase
        .from("monthly_reports")
        .select("period,sent_at")
        .eq("client_id", clientId)
        .gte("sent_at", since)
        .limit(REPORTS_LIMIT),
      supabase
        .from("approval_queue")
        .select("kind,title,created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true })
        .limit(APPROVALS_LIMIT),
      supabase
        .from("payments")
        .select("amount,currency,status,due_date,description")
        .eq("client_id", clientId)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(PAYMENTS_LIMIT),
      supabase.from("client_intake").select("client_id").eq("client_id", clientId).maybeSingle(),
      fetchCapped((from, to) =>
        supabase
          .from("ad_insights_daily")
          .select("id,date,spend,currency,messaging_conversations_started")
          .eq("client_id", clientId)
          .eq("level", "campaign")
          .gte("date", insightsFrom)
          .lte("date", today)
          .order("date", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      fetchCapped((from, to) =>
        supabase
          .from("google_ads_insights_daily")
          .select("id,date,cost_clp,conversions")
          .eq("client_id", clientId)
          .gte("date", insightsFrom)
          .lte("date", today)
          .order("date", { ascending: false })
          .order("id")
          .range(from, to),
      ),
    ]);

  return {
    deliverables: must(deliverables) ?? [],
    posts: must(posts) ?? [],
    tasks: must(tasks) ?? [],
    reports: must(reports) ?? [],
    approvals: must(approvals) ?? [],
    payments: (must(payments) ?? []).map((p) => ({ ...p, amount: Number(p.amount) })),
    intakeSubmitted: Boolean(must(intake)),
    meta: meta.rows,
    google: google.rows,
    campaignsTruncated: meta.truncated || google.truncated,
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
