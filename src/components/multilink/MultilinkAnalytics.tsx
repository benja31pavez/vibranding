import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withoutBots } from "@/lib/analytics/bots";
import { Button } from "@/components/ui/button";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, MessageCircle, MousePointerClick, Users } from "lucide-react";
import type { MultilinkItem } from "@/lib/multilink";

type EventRow = {
  user_agent?: string | null;
  event_name: string;
  item_id: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

const RANGES = [7, 30, 90];

function sourceLabel(r: EventRow): string {
  if (r.utm_source) {
    return [r.utm_source, r.utm_medium].filter(Boolean).join(" / ");
  }
  const ref = (r.referrer ?? "").trim();
  if (!ref) return "Directo / app";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (/instagram/.test(host)) return "Instagram";
    if (/facebook|fb\./.test(host)) return "Facebook";
    if (/whatsapp|wa\.me/.test(host)) return "WhatsApp";
    if (/t\.co|twitter|x\.com/.test(host)) return "X / Twitter";
    if (/tiktok/.test(host)) return "TikTok";
    if (/google/.test(host)) return "Google";
    return host;
  } catch {
    return "Otro";
  }
}

/**
 * Per-link analytics computed from landing_events: clicks over time,
 * click-through rate per item and traffic source.
 */
export function MultilinkAnalytics({
  clientId,
  multilinkId,
  items,
}: {
  clientId: string;
  multilinkId: string;
  items: MultilinkItem[];
}) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = new Date(Date.now() - (days - 1) * 86400000);
    from.setHours(0, 0, 0, 0);
    supabase
      .from("landing_events")
      .select(
        "event_name,item_id,referrer,utm_source,utm_medium,utm_campaign,created_at,user_agent",
      )
      .eq("client_id", clientId)
      .eq("source_type", "multilink")
      .eq("source_id", multilinkId)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setRows(withoutBots((data ?? []) as EventRow[]));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, multilinkId, days]);

  const views = rows.filter((r) => r.event_name === "page_view").length;
  const clickRows = useMemo(
    () => rows.filter((r) => r.event_name === "link_click" || r.event_name === "whatsapp_click"),
    [rows],
  );

  const series = useMemo(() => {
    const b = new Map<string, { date: string; visitas: number; clics: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      b.set(k, { date: k, visitas: 0, clics: 0 });
    }
    for (const r of rows) {
      const day = b.get(r.created_at.slice(0, 10));
      if (!day) continue;
      if (r.event_name === "page_view") day.visitas++;
      else day.clics++;
    }
    return Array.from(b.values());
  }, [rows, days]);

  const perItem = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of clickRows) {
      if (!r.item_id) continue;
      counts.set(r.item_id, (counts.get(r.item_id) ?? 0) + 1);
    }
    return items
      .map((i) => ({ item: i, clicks: counts.get(i.id) ?? 0 }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [clickRows, items]);

  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows.filter((r) => r.event_name === "page_view")) {
      const k = sourceLabel(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [rows]);

  const totalCtr = views > 0 ? (clickRows.length / views) * 100 : null;
  const waClicks = clickRows.filter((r) => r.event_name === "whatsapp_click").length;
  const maxClicks = Math.max(1, ...perItem.map((p) => p.clicks));

  return (
    <section className="rounded-2xl border bg-surface p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" /> Analítica del multienlace
        </h3>
        <div className="flex gap-1">
          {RANGES.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d} días
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin eventos en este período. Los datos aparecen cuando alguien visita el multienlace
          publicado.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={Users} label="Visitas" value={views} />
            <Kpi icon={MousePointerClick} label="Clics en enlaces" value={clickRows.length} />
            <Kpi icon={MessageCircle} label="Clics a WhatsApp" value={waClicks} />
            <Kpi
              icon={Activity}
              label="Visitas que hacen clic"
              value={totalCtr === null ? "—" : `${totalCtr.toFixed(1)}%`}
            />
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                <Tooltip
                  labelFormatter={(v) => new Date(`${v}T12:00:00`).toLocaleDateString("es-CL")}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  name="Visitas"
                  dataKey="visitas"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  name="Clics"
                  dataKey="clics"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Clics por enlace (y % de visitas que lo tocaron)
              </div>
              {perItem.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay enlaces.</p>
              ) : (
                <ul className="space-y-2">
                  {perItem.map(({ item, clicks }) => {
                    const ctr = views > 0 ? (clicks / views) * 100 : null;
                    const width = (clicks / maxClicks) * 100;
                    return (
                      <li key={item.id} className="space-y-1">
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="truncate">{item.title}</span>
                          <span className="text-muted-foreground shrink-0">
                            <span className="font-medium text-foreground">{clicks}</span> clic
                            {clicks === 1 ? "" : "s"} · {ctr === null ? "—" : `${ctr.toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${width}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-2">De dónde llegan las visitas</div>
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin visitas registradas.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {sources.map(([k, n]) => (
                    <li key={k} className="flex justify-between gap-3 border-b py-1 last:border-0">
                      <span className="truncate">{k}</span>
                      <span className="font-medium">{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
