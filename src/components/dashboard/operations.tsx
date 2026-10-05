import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState, Panel } from "@/components/app";
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

export function OperationsPanels() {
  const deliverables = useUpcomingDeliverables();
  const posts = useScheduledPosts();
  const clients = useClientIndex();
  const nameOf = (id: string) => clients.data?.nameById.get(id) ?? "—";

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel
        icon={CheckSquare}
        title="Próximas etapas"
        description={`Vencen en ${UPCOMING_DAYS} días o antes`}
      >
        <BlockState query={deliverables} loadingLabel="Cargando etapas">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState size="compact" title="Nada pendiente esta semana." />
            ) : (
              <ul className="space-y-2">
                {rows.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      to="/clients/$clientId/deliverables"
                      params={{ clientId: d.client_id }}
                      className="min-w-0 truncate hover:underline"
                    >
                      <span className="font-medium">{d.title}</span>{" "}
                      <span className="text-muted-foreground">· {nameOf(d.client_id)}</span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatShortDate(d.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </BlockState>
      </Panel>

      <Panel icon={CalendarClock} title="Próximas publicaciones">
        <BlockState query={posts} loadingLabel="Cargando publicaciones">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyState size="compact" title="Sin publicaciones programadas." />
            ) : (
              <ul className="space-y-2">
                {rows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      to="/clients/$clientId/instagram"
                      params={{ clientId: p.client_id }}
                      className="min-w-0 truncate hover:underline"
                    >
                      <span className="font-medium">{nameOf(p.client_id)}</span>{" "}
                      <span className="text-muted-foreground">· {p.type}</span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {p.scheduled_at
                        ? new Date(p.scheduled_at).toLocaleString("es-CL", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "America/Santiago",
                          })
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </BlockState>
      </Panel>
    </section>
  );
}
