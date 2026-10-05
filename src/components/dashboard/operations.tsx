import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState, Panel } from "@/components/app";
import { cn } from "@/lib/utils";
import { BlockState } from "./block-state";
import {
  UPCOMING_DAYS,
  addDays,
  chileStartOfDayIso,
  chileToday,
  dashboardKeys,
  formatShortDate,
  useClientIndex,
} from "./queries";

const LIST_LIMIT = 8;

type Deliverable = { id: string; title: string; due_date: string | null; client_id: string };
type ScheduledPost = { id: string; scheduled_at: string | null; client_id: string; type: string };

function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
}

/** Etapas no terminadas que vencen en ≤ 7 días (incluye atrasadas). */
function useUpcomingDeliverables() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...dashboardKeys.operations(userId), "deliverables"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Deliverable[]> => {
      const { data, error } = await supabase
        .from("deliverables")
        .select("id,title,due_date,client_id")
        .neq("status", "done")
        .lte("due_date", addDays(chileToday(), UPCOMING_DAYS))
        .order("due_date", { ascending: true })
        .limit(LIST_LIMIT);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/** Publicaciones desde las 00:00 de hoy en Chile (instante real, no fecha UTC). */
function useScheduledPosts() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...dashboardKeys.operations(userId), "posts"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ScheduledPost[]> => {
      const { data, error } = await supabase
        .from("instagram_posts")
        .select("id,scheduled_at,client_id,type")
        .gte("scheduled_at", chileStartOfDayIso())
        .order("scheduled_at", { ascending: true })
        .limit(LIST_LIMIT);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/** Etapas por vencer (incluye atrasadas). */
export function UpcomingDeliverablesPanel() {
  const deliverables = useUpcomingDeliverables();
  const clients = useClientIndex();
  const nameOf = (id: string) => clients.data?.nameById.get(id) ?? "—";
  const today = chileToday();

  return (
    <Panel
      className="min-w-0"
      icon={CheckSquare}
      title="Próximas etapas"
      description={`Vencen en ${UPCOMING_DAYS} días o antes`}
    >
      <BlockState query={deliverables} loadingLabel="Cargando etapas">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              size="compact"
              className="py-3"
              icon={CheckSquare}
              title="Nada pendiente esta semana."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((d) => {
                const late = Boolean(d.due_date && d.due_date < today);
                return (
                  <li
                    key={d.id}
                    className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <Link
                      to="/clients/$clientId/deliverables"
                      params={{ clientId: d.client_id }}
                      className="min-w-0 hover:underline"
                    >
                      <span className="block truncate font-medium">{d.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {nameOf(d.client_id)}
                      </span>
                    </Link>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        late ? "font-medium text-danger-strong" : "text-muted-foreground",
                      )}
                    >
                      {formatShortDate(d.due_date)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        }
      </BlockState>
    </Panel>
  );
}

function formatPostTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

/** Publicaciones programadas desde hoy. */
export function ScheduledPostsPanel() {
  const posts = useScheduledPosts();
  const clients = useClientIndex();
  const nameOf = (id: string) => clients.data?.nameById.get(id) ?? "—";

  return (
    <Panel className="min-w-0" icon={CalendarClock} title="Próximas publicaciones">
      <BlockState query={posts} loadingLabel="Cargando publicaciones">
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              size="compact"
              className="py-3"
              icon={CalendarClock}
              title="Sin publicaciones programadas."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((p) => (
                <li
                  key={p.id}
                  className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                >
                  <Link
                    to="/clients/$clientId/instagram"
                    params={{ clientId: p.client_id }}
                    className="min-w-0 hover:underline"
                  >
                    <span className="block truncate font-medium">{nameOf(p.client_id)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.type}</span>
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatPostTime(p.scheduled_at)}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </BlockState>
    </Panel>
  );
}
