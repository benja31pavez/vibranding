import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, MousePointerClick } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState, ErrorState, PageHeader, StatCard, TableSkeleton } from "@/components/app";

export const Route = createFileRoute("/_app/stats")({
  component: StatsPage,
  head: () => ({
    meta: [
      { title: "Estadísticas del landing · Vibranding" },
      { name: "description", content: "Clics en Contacto y WhatsApp registrados desde la landing pública." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const EVENTS = [
  { key: "contact_click", label: "Clics en «Contacto»", short: "Contacto", icon: MousePointerClick },
  { key: "whatsapp_click", label: "Clics en WhatsApp", short: "WhatsApp", icon: MessageCircle },
] as const;
type EventKey = (typeof EVENTS)[number]["key"];

/** Ventanas de conteo: undefined = histórico total. */
const WINDOWS = [
  { key: "total", label: "Total", days: undefined },
  { key: "d30", label: "Últimos 30 días", days: 30 },
  { key: "d7", label: "Últimos 7 días", days: 7 },
] as const;
type WindowKey = (typeof WINDOWS)[number]["key"];

const RECENT_LIMIT = 50;
const DAY_MS = 86_400_000;
const NUM = new Intl.NumberFormat("es-CL");
const DATE_TIME = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

type Counts = Record<EventKey, Record<WindowKey, number>>;
interface RecentRow {
  id: string;
  event_name: string;
  path: string | null;
  referrer: string | null;
  created_at: string;
}

/** Conteos exactos en la BD (sin traer filas): nunca se truncan. */
async function loadCounts(): Promise<Counts> {
  const now = Date.now();
  const jobs = EVENTS.flatMap((e) =>
    WINDOWS.map(async (w) => {
      let q = supabase
        .from("landing_events")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "site")
        .eq("event_name", e.key);
      if (w.days) q = q.gte("created_at", new Date(now - w.days * DAY_MS).toISOString());
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return { event: e.key, window: w.key, count: count ?? 0 };
    }),
  );
  const results = await Promise.all(jobs);
  const empty = { total: 0, d30: 0, d7: 0 };
  const counts: Counts = { contact_click: { ...empty }, whatsapp_click: { ...empty } };
  return results.reduce<Counts>(
    (acc, r) => ({ ...acc, [r.event]: { ...acc[r.event], [r.window]: r.count } }),
    counts,
  );
}

async function loadRecent(): Promise<RecentRow[]> {
  const { data, error } = await supabase
    .from("landing_events")
    .select("id,event_name,path,referrer,created_at")
    .eq("source_type", "site")
    .in("event_name", EVENTS.map((e) => e.key))
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as RecentRow[];
}

function StatsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const counts = useQuery({ queryKey: ["landing-stats", userId, "counts"], enabled: Boolean(userId), queryFn: loadCounts });
  const recent = useQuery({ queryKey: ["landing-stats", userId, "recent"], enabled: Boolean(userId), queryFn: loadRecent });

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 md:px-10">
      <PageHeader title="Estadísticas del landing" description="Clics registrados desde la landing pública." />

      {counts.isError ? (
        <ErrorState
          message={counts.error instanceof Error ? counts.error.message : undefined}
          onRetry={() => void counts.refetch()}
          retrying={counts.isFetching}
        />
      ) : (
        <div className="space-y-4">
          {EVENTS.map(({ key, label, icon }) => (
            <section key={key} aria-label={label} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {WINDOWS.map((w) => (
                  <StatCard
                    key={w.key}
                    icon={icon}
                    label={w.label}
                    loading={counts.isPending}
                    value={NUM.format(counts.data?.[key][w.key] ?? 0)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="space-y-3" aria-labelledby="recent-title">
        <h2 id="recent-title" className="text-lg font-semibold">Últimos clics</h2>
        {recent.isError ? (
          <ErrorState
            message={recent.error instanceof Error ? recent.error.message : undefined}
            onRetry={() => void recent.refetch()}
            retrying={recent.isFetching}
          />
        ) : recent.isPending ? (
          <TableSkeleton rows={5} columns={4} label="Cargando últimos clics" />
        ) : recent.data.length === 0 ? (
          <EmptyState icon={MousePointerClick} title="Aún no hay clics registrados." />
        ) : (
          <div className="overflow-x-auto rounded-app-lg border border-border-subtle bg-surface shadow-app-xs">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-border-subtle text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Evento</th>
                  <th scope="col" className="px-4 py-2 font-medium">Ruta</th>
                  <th scope="col" className="px-4 py-2 font-medium">Origen</th>
                  <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 py-2">{EVENTS.find((e) => e.key === r.event_name)?.short ?? r.event_name}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-muted-foreground">{r.path ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-muted-foreground">{r.referrer || "Directo"}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{DATE_TIME.format(new Date(r.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
