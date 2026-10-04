import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState, Panel } from "@/components/app";
import { BlockState } from "./block-state";
import { UPCOMING_DAYS, addDays, chileToday, dashboardKeys, formatShortDate, useClientIndex } from "./queries";

const LIST_LIMIT = 8;

interface Operations {
  deliverables: { id: string; title: string; due_date: string | null; client_id: string }[];
  posts: { id: string; scheduled_at: string | null; client_id: string; type: string }[];
}

/** Etapas por vencer y publicaciones programadas (lo útil del inicio anterior). */
function useOperations() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: dashboardKeys.operations(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Operations> => {
      const today = chileToday();
      const [dels, posts] = await Promise.all([
        supabase.from("deliverables").select("id,title,due_date,client_id").neq("status", "done")
          .lte("due_date", addDays(today, UPCOMING_DAYS)).order("due_date", { ascending: true }).limit(LIST_LIMIT),
        supabase.from("instagram_posts").select("id,scheduled_at,client_id,type")
          .gte("scheduled_at", today).order("scheduled_at", { ascending: true }).limit(LIST_LIMIT),
      ]);
      const error = dels.error ?? posts.error;
      if (error) throw new Error(error.message);
      return { deliverables: dels.data ?? [], posts: posts.data ?? [] };
    },
  });
}

export function OperationsPanels() {
  const query = useOperations();
  const clients = useClientIndex();
  const nameOf = (id: string) => clients.data?.nameById.get(id) ?? "—";

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel icon={CheckSquare} title="Próximas etapas" description={`Vencen en ${UPCOMING_DAYS} días o antes`}>
        <BlockState query={query} loadingLabel="Cargando etapas">
          {(data) =>
            data.deliverables.length === 0 ? (
              <EmptyState size="compact" title="Nada pendiente esta semana." />
            ) : (
              <ul className="space-y-2">
                {data.deliverables.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link to="/clients/$clientId/deliverables" params={{ clientId: d.client_id }} className="min-w-0 truncate hover:underline">
                      <span className="font-medium">{d.title}</span> <span className="text-muted-foreground">· {nameOf(d.client_id)}</span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatShortDate(d.due_date)}</span>
                  </li>
                ))}
              </ul>
            )
          }
        </BlockState>
      </Panel>

      <Panel icon={CalendarClock} title="Próximas publicaciones">
        <BlockState query={query} loadingLabel="Cargando publicaciones">
          {(data) =>
            data.posts.length === 0 ? (
              <EmptyState size="compact" title="Sin publicaciones programadas." />
            ) : (
              <ul className="space-y-2">
                {data.posts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link to="/clients/$clientId/instagram" params={{ clientId: p.client_id }} className="min-w-0 truncate hover:underline">
                      <span className="font-medium">{nameOf(p.client_id)}</span> <span className="text-muted-foreground">· {p.type}</span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {p.scheduled_at
                        ? new Date(p.scheduled_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" })
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
