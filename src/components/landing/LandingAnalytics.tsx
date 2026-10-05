import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, MessageCircle, MousePointerClick, Send, Users } from "lucide-react";

type EventRow = {
  event_name: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  created_at: string;
};

const RANGES = [7, 30, 90];

function sourceLabel(r: EventRow): string {
  if (r.utm_source) return [r.utm_source, r.utm_medium].filter(Boolean).join(" / ");
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
 * Landing analytics computed from landing_events: visits, CTA and WhatsApp
 * clicks, form submissions, conversion rate and traffic sources.
 */
export function LandingAnalytics({ clientId, landingId }: { clientId: string; landingId: string }) {
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
      .select("event_name,referrer,utm_source,utm_medium,created_at")
      .eq("client_id", clientId)
      .eq("source_type", "landing")
      .eq("source_id", landingId)
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
  }, [clientId, landingId, days]);

  const count = (name: string) => rows.filter((r) => r.event_name === name).length;
  const views = count("page_view");
  const ctaClicks = count("contact_click");
  const waClicks = count("whatsapp_click");
  const submits = count("contact_submit");
  const conversion = views > 0 ? ((submits + waClicks) / views) * 100 : null;

  const series = useMemo(() => {
    const b = new Map<string, { date: string; visitas: number; clics: number; envios: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      b.set(k, { date: k, visitas: 0, clics: 0, envios: 0 });
    }
    for (const r of rows) {
      const day = b.get(r.created_at.slice(0, 10));
      if (!day) continue;
      if (r.event_name === "page_view") day.visitas++;
      else if (r.event_name === "contact_submit") day.envios++;
      else day.clics++;
    }
    return Array.from(b.values());
  }, [rows, days]);

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

  return (
    <section className="rounded-2xl border bg-surface p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" /> Analítica de la landing
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
          Sin eventos en este período. Los datos aparecen cuando alguien visita la landing
          publicada.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi icon={Users} label="Visitas" value={views} />
            <Kpi icon={MousePointerClick} label="Clics CTA" value={ctaClicks} />
            <Kpi icon={MessageCircle} label="Clics WhatsApp" value={waClicks} />
            <Kpi icon={Send} label="Formularios" value={submits} />
            <Kpi
              icon={Activity}
              label="Conversión"
              value={conversion === null ? "—" : `${conversion.toFixed(1)}%`}
            />
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="visitas" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="clics" stroke="#25D366" dot={false} />
                <Line type="monotone" dataKey="envios" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">Fuentes de tráfico</div>
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin visitas registradas.</p>
            ) : (
              <ul className="text-sm space-y-1 md:max-w-md">
                {sources.map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-3 border-b py-1 last:border-0">
                    <span className="truncate">{k}</span>
                    <span className="font-medium">{n}</span>
                  </li>
                ))}
              </ul>
            )}
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
