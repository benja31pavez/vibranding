import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

interface Evt {
  id: string;
  scheduled_at: string;
  client_id: string;
  client_name: string;
  type: string;
  caption: string | null;
}

const COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-pink-500", "bg-amber-500",
  "bg-violet-500", "bg-cyan-500", "bg-rose-500", "bg-lime-500",
];

function CalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [events, setEvents] = useState<Evt[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString();
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).toISOString();
      const { data: clients } = await supabase.from("clients").select("id,name");
      const ids = (clients ?? []).map((c) => c.id);
      const nameById = new Map((clients ?? []).map((c) => [c.id, c.name]));
      if (!ids.length) return setEvents([]);
      const { data } = await supabase
        .from("instagram_posts")
        .select("id,scheduled_at,client_id,type,caption")
        .in("client_id", ids)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .not("scheduled_at", "is", null);
      setEvents((data ?? []).map((e: any) => ({ ...e, client_name: nameById.get(e.client_id) ?? "—" })));
    })();
  }, [user, cursor]);

  const colorByClient = useMemo(() => {
    const ids = Array.from(new Set(events.map((e) => e.client_id)));
    const map = new Map<string, string>();
    ids.forEach((id, i) => map.set(id, COLORS[i % COLORS.length]));
    return map;
  }, [events]);

  const monthName = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = useMemo(() => {
    const m = new Map<number, Evt[]>();
    for (const e of events) {
      const day = new Date(e.scheduled_at).getDate();
      const arr = m.get(day) ?? [];
      arr.push(e);
      m.set(day, arr);
    }
    return m;
  }, [events]);

  const selectedEvents = selected
    ? eventsByDay.get(Number(selected.split("-")[2])) ?? []
    : [];

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-muted-foreground">Publicaciones programadas de todos tus clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="font-medium capitalize w-44 text-center">{monthName}</div>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border bg-surface p-3">
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1 px-1">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div key={d} className="px-2 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-24 rounded-lg" />;
              const dayEvents = eventsByDay.get(d) ?? [];
              const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${d}`;
              const isSelected = selected === key;
              const isToday =
                d === new Date().getDate() &&
                cursor.getMonth() === new Date().getMonth() &&
                cursor.getFullYear() === new Date().getFullYear();
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={`h-24 rounded-lg border p-1.5 text-left transition-colors flex flex-col gap-1 ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
                  }`}
                >
                  <div className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}>{d}</div>
                  <div className="flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 4).map((e) => (
                      <span key={e.id} className={`w-2 h-2 rounded-full ${colorByClient.get(e.client_id)}`} title={e.client_name} />
                    ))}
                    {dayEvents.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 4}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border bg-surface p-4">
          <h2 className="font-semibold mb-3">{selected ? `Día ${selected.split("-")[2]}` : "Selecciona un día"}</h2>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin publicaciones.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id} className="text-sm">
                  <Link to="/clients/$clientId/instagram" params={{ clientId: e.client_id }} className="block rounded-lg border p-2 hover:bg-secondary/40">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${colorByClient.get(e.client_id)}`} />
                      <span className="font-medium">{e.client_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(e.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{e.type}{e.caption ? ` · ${e.caption.slice(0, 60)}` : ""}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Clientes</h3>
            <ul className="space-y-1">
              {Array.from(colorByClient.entries()).map(([id, color]) => {
                const name = events.find((e) => e.client_id === id)?.client_name ?? "—";
                return (
                  <li key={id} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${color}`} /> {name}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
