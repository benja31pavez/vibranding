import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { MessageCircle, ArrowDownLeft, ArrowUpRight, Star, Bot, Users, Hash } from "lucide-react";

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  from_bot: boolean;
  timestamp: string;
  conversation_id: string;
};

type Conv = {
  id: string;
  contact_wa_id: string;
};

// Mapeo simplificado de prefijos internacionales a país (cubre LATAM + principales).
const COUNTRY_PREFIXES: Array<[string, string, string]> = [
  // [prefix, country name, flag]
  ["1", "EE.UU./Canadá", "🇺🇸"],
  ["7", "Rusia", "🇷🇺"],
  ["20", "Egipto", "🇪🇬"],
  ["27", "Sudáfrica", "🇿🇦"],
  ["30", "Grecia", "🇬🇷"],
  ["31", "Países Bajos", "🇳🇱"],
  ["32", "Bélgica", "🇧🇪"],
  ["33", "Francia", "🇫🇷"],
  ["34", "España", "🇪🇸"],
  ["36", "Hungría", "🇭🇺"],
  ["39", "Italia", "🇮🇹"],
  ["40", "Rumanía", "🇷🇴"],
  ["41", "Suiza", "🇨🇭"],
  ["43", "Austria", "🇦🇹"],
  ["44", "Reino Unido", "🇬🇧"],
  ["45", "Dinamarca", "🇩🇰"],
  ["46", "Suecia", "🇸🇪"],
  ["47", "Noruega", "🇳🇴"],
  ["48", "Polonia", "🇵🇱"],
  ["49", "Alemania", "🇩🇪"],
  ["51", "Perú", "🇵🇪"],
  ["52", "México", "🇲🇽"],
  ["53", "Cuba", "🇨🇺"],
  ["54", "Argentina", "🇦🇷"],
  ["55", "Brasil", "🇧🇷"],
  ["56", "Chile", "🇨🇱"],
  ["57", "Colombia", "🇨🇴"],
  ["58", "Venezuela", "🇻🇪"],
  ["60", "Malasia", "🇲🇾"],
  ["61", "Australia", "🇦🇺"],
  ["62", "Indonesia", "🇮🇩"],
  ["63", "Filipinas", "🇵🇭"],
  ["64", "Nueva Zelanda", "🇳🇿"],
  ["65", "Singapur", "🇸🇬"],
  ["66", "Tailandia", "🇹🇭"],
  ["81", "Japón", "🇯🇵"],
  ["82", "Corea del Sur", "🇰🇷"],
  ["84", "Vietnam", "🇻🇳"],
  ["86", "China", "🇨🇳"],
  ["90", "Turquía", "🇹🇷"],
  ["91", "India", "🇮🇳"],
  ["92", "Pakistán", "🇵🇰"],
  ["234", "Nigeria", "🇳🇬"],
  ["351", "Portugal", "🇵🇹"],
  ["352", "Luxemburgo", "🇱🇺"],
  ["353", "Irlanda", "🇮🇪"],
  ["354", "Islandia", "🇮🇸"],
  ["358", "Finlandia", "🇫🇮"],
  ["359", "Bulgaria", "🇧🇬"],
  ["372", "Estonia", "🇪🇪"],
  ["420", "Chequia", "🇨🇿"],
  ["502", "Guatemala", "🇬🇹"],
  ["503", "El Salvador", "🇸🇻"],
  ["504", "Honduras", "🇭🇳"],
  ["505", "Nicaragua", "🇳🇮"],
  ["506", "Costa Rica", "🇨🇷"],
  ["507", "Panamá", "🇵🇦"],
  ["509", "Haití", "🇭🇹"],
  ["591", "Bolivia", "🇧🇴"],
  ["593", "Ecuador", "🇪🇨"],
  ["595", "Paraguay", "🇵🇾"],
  ["598", "Uruguay", "🇺🇾"],
  ["809", "Rep. Dominicana", "🇩🇴"],
  ["829", "Rep. Dominicana", "🇩🇴"],
  ["849", "Rep. Dominicana", "🇩🇴"],
  ["971", "Emiratos Árabes", "🇦🇪"],
  ["972", "Israel", "🇮🇱"],
];

function lookupCountry(wa: string): { name: string; flag: string } {
  const digits = wa.replace(/\D/g, "");
  // Probar de más largo a más corto.
  const sorted = [...COUNTRY_PREFIXES].sort((a, b) => b[0].length - a[0].length);
  for (const [pref, name, flag] of sorted) {
    if (digits.startsWith(pref)) return { name, flag };
  }
  return { name: "Desconocido", flag: "🏳️" };
}

export function MetricsTab({ clientId }: { clientId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [leads, setLeads] = useState(0);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    (async () => {
      const [{ data: m }, { data: c }, { count }] = await Promise.all([
        supabase
          .from("whatsapp_messages")
          .select("id,direction,from_bot,timestamp,conversation_id")
          .eq("client_id", clientId)
          .gte("timestamp", since.toISOString()),
        supabase
          .from("whatsapp_conversations")
          .select("id,contact_wa_id")
          .eq("client_id", clientId),
        supabase
          .from("whatsapp_conversations")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("is_lead", true),
      ]);
      setMsgs((m ?? []) as Msg[]);
      setConvs((c ?? []) as Conv[]);
      setLeads(count ?? 0);
    })();
  }, [clientId]);

  const stats = useMemo(() => {
    const inbound = msgs.filter((m) => m.direction === "inbound");
    const outbound = msgs.filter((m) => m.direction === "outbound").length;
    const bot = msgs.filter((m) => m.from_bot).length;
    const uniqueUsers = new Set(inbound.map((m) => m.conversation_id)).size;
    const avgPerUser = uniqueUsers > 0 ? inbound.length / uniqueUsers : 0;
    return {
      inbound: inbound.length,
      outbound,
      bot,
      total: msgs.length,
      uniqueUsers,
      avgPerUser,
    };
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

  // Países: por conversación (usuario único), solo los que han escrito en los últimos 30d.
  const countryData = useMemo(() => {
    const activeConvIds = new Set(
      msgs.filter((m) => m.direction === "inbound").map((m) => m.conversation_id),
    );
    const counts = new Map<string, { name: string; flag: string; count: number }>();
    for (const c of convs) {
      if (!activeConvIds.has(c.id)) continue;
      const { name, flag } = lookupCountry(c.contact_wa_id);
      const key = `${flag} ${name}`;
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { name, flag, count: 1 });
    }
    return Array.from(counts.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [convs, msgs]);

  // Horario: distribución por hora del día (mensajes recibidos), en hora local del navegador.
  const hourData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}h`,
      count: 0,
    }));
    for (const m of msgs) {
      if (m.direction !== "inbound") continue;
      const h = new Date(m.timestamp).getHours();
      buckets[h].count++;
    }
    return buckets;
  }, [msgs]);

  const peakHour = useMemo(() => {
    let best = { hour: "—", count: 0 };
    for (const b of hourData) if (b.count > best.count) best = b;
    return best;
  }, [hourData]);

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat icon={MessageCircle} label="Mensajes (30 d)" value={stats.total} />
        <Stat icon={ArrowDownLeft} label="Recibidos" value={stats.inbound} />
        <Stat icon={ArrowUpRight} label="Enviados" value={stats.outbound} />
        <Stat icon={Bot} label="Respuestas del bot" value={stats.bot} />
        <Stat icon={Users} label="Usuarios únicos" value={stats.uniqueUsers} />
        <Stat icon={Hash} label="Msj / usuario" value={stats.avgPerUser.toFixed(1)} />
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
              <Line
                type="monotone"
                dataKey="in"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Recibidos"
              />
              <Line
                type="monotone"
                dataKey="out"
                stroke="#10b981"
                strokeWidth={2}
                name="Enviados"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Países de tus clientes</CardTitle>
            <p className="text-xs text-muted-foreground">
              Detectado por el prefijo internacional del número.
            </p>
          </CardHeader>
          <CardContent>
            {countryData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay datos.</p>
            ) : (
              <ul className="space-y-2">
                {countryData.map((c) => {
                  const max = countryData[0].count;
                  const pct = (c.count / max) * 100;
                  return (
                    <li key={c.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          <span className="mr-2">{c.flag}</span>
                          {c.name}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{c.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horario en que escriben</CardTitle>
            <p className="text-xs text-muted-foreground">
              {peakHour.count > 0
                ? `Hora más activa: ${peakHour.hour} (${peakHour.count} mensajes)`
                : "Aún no hay datos."}
            </p>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
