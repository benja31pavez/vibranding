import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";

type EventRow = {
  event_name: string;
  item_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

const EVENT_LABEL: Record<string, string> = {
  page_view: "Visitas",
  link_click: "Clics en enlaces",
  whatsapp_click: "Clics a WhatsApp",
  contact_click: "Clics en CTA",
  contact_submit: "Formularios enviados",
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

/**
 * Time series over landing_events. The view_count / click_count columns are
 * cached totals only; every number here is computed from the event stream.
 */
export function EventsPanel({
  clientId,
  sourceType,
  sourceId,
  itemLabels,
}: {
  clientId: string;
  sourceType: "landing" | "multilink";
  sourceId: string;
  itemLabels?: Record<string, string>;
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
      .select("event_name,item_id,utm_source,utm_medium,utm_campaign,created_at")
      .eq("client_id", clientId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .gte("created_at", from.toISOString())
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data ?? []) as EventRow[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, sourceType, sourceId, days]);

  const series = useMemo(() => {
    const buckets = new Map<string, { date: string; views: number; clicks: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const k = d.toISOString().slice(0, 10);
      buckets.set(k, { date: k, views: 0, clicks: 0 });
    }
    for (const r of rows) {
      const b = buckets.get(dayKey(r.created_at));
      if (!b) continue;
      if (r.event_name === "page_view") b.views++;
      else b.clicks++;
    }
    return Array.from(buckets.values());
  }, [rows, days]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of rows) t[r.event_name] = (t[r.event_name] ?? 0) + 1;
    return t;
  }, [rows]);

  const byItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.event_name !== "link_click" || !r.item_id) continue;
      m.set(r.item_id, (m.get(r.item_id) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byCampaign = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ");
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const hasData = rows.length > 0;

  return (
    <section className="rounded-2xl border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium flex items-center gap-2">
          <BarChart3 className="w-4 h-4" /> Actividad
        </h3>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? "default" : "outline"}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !hasData ? (
        <p className="text-sm text-muted-foreground">
          Sin eventos registrados en este período. Los datos aparecen cuando alguien visita la
          página publicada.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.keys(EVENT_LABEL)
              .filter((k) => totals[k])
              .map((k) => (
                <div key={k} className="rounded-xl border bg-background p-3">
                  <div className="text-xs text-muted-foreground">{EVENT_LABEL[k]}</div>
                  <div className="text-xl font-semibold mt-1">{totals[k]}</div>
                </div>
              ))}
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="views"
                  name="Visitas"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.18}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  name="Clics"
                  stroke="#25D366"
                  fill="#25D366"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {byItem.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Clics por enlace</div>
              <ul className="text-sm space-y-1">
                {byItem.map(([id, n]) => (
                  <li key={id} className="flex justify-between gap-3 border-b py-1 last:border-0">
                    <span className="truncate">{itemLabels?.[id] ?? id.slice(0, 8)}</span>
                    <span className="font-medium">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {byCampaign.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Campañas (utm)</div>
              <ul className="text-sm space-y-1">
                {byCampaign.map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-3 border-b py-1 last:border-0">
                    <span className="truncate">{k}</span>
                    <span className="font-medium">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
