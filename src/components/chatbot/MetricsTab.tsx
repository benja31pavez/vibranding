import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MessageCircle, ArrowDownLeft, ArrowUpRight, Star, Bot } from "lucide-react";

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  from_bot: boolean;
  timestamp: string;
};

export function MetricsTab({ clientId }: { clientId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [leads, setLeads] = useState(0);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    (async () => {
      const [{ data: m }, { count }] = await Promise.all([
        supabase
          .from("whatsapp_messages")
          .select("id,direction,from_bot,timestamp")
          .eq("client_id", clientId)
          .gte("timestamp", since.toISOString()),
        supabase
          .from("whatsapp_conversations")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("is_lead", true),
      ]);
      setMsgs((m ?? []) as Msg[]);
      setLeads(count ?? 0);
    })();
  }, [clientId]);

  const stats = useMemo(() => {
    const inbound = msgs.filter((m) => m.direction === "inbound").length;
    const outbound = msgs.filter((m) => m.direction === "outbound").length;
    const bot = msgs.filter((m) => m.from_bot).length;
    return { inbound, outbound, bot, total: msgs.length };
  }, [msgs]);

  const series = useMemo(() => {
    const map = new Map<string, { date: string; in: number; out: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      map.set(k, { date: k.slice(5), in: 0, out: 0 });
    }
    for (const m of msgs) {
      const k = m.timestamp.slice(0, 10);
      const row = map.get(k);
      if (!row) continue;
      if (m.direction === "inbound") row.in++;
      else row.out++;
    }
    return Array.from(map.values());
  }, [msgs]);

  const Stat = ({ icon: Icon, label, value }: any) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={MessageCircle} label="Mensajes (30 d)" value={stats.total} />
        <Stat icon={ArrowDownLeft} label="Recibidos" value={stats.inbound} />
        <Stat icon={ArrowUpRight} label="Enviados" value={stats.outbound} />
        <Stat icon={Bot} label="Respuestas del bot" value={stats.bot} />
        <Stat icon={Star} label="Leads totales" value={leads} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad diaria — últimos 30 días</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="in" stroke="hsl(var(--primary))" strokeWidth={2} name="Recibidos" />
              <Line type="monotone" dataKey="out" stroke="#10b981" strokeWidth={2} name="Enviados" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
