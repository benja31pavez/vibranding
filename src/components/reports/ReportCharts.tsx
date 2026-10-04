import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtInt } from "@/lib/reports/format";

const AXIS_FONT = 11;

/** Visitas por día del mes. */
export function DailyVisitsChart({ data }: { data: { date: string; visits: number }[] }) {
  return (
    <div className="h-48 w-full print:h-40" role="img" aria-label="Gráfico de visitas por día">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => String(Number(v.slice(8)))}
            fontSize={AXIS_FONT}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis allowDecimals={false} fontSize={AXIS_FONT} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v: number) => [fmtInt(v), "Visitas"]}
            labelFormatter={(v: string) => `Día ${Number(v.slice(8))}`}
          />
          <Area
            type="monotone"
            dataKey="visits"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontales: contactos por canal. */
export function LeadsBySourceChart({ data }: { data: { label: string; count: number }[] }) {
  const height = Math.max(96, data.length * 40);
  return (
    <div className="w-full" style={{ height }} role="img" aria-label="Gráfico de contactos por canal">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={112} fontSize={AXIS_FONT} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => [fmtInt(v), "Contactos"]} />
          <Bar dataKey="count" fill="var(--primary)" radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
