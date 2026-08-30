import { useMemo } from "react";
import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { IGPost } from "@/components/InstagramEditor";
import { usePostInsights } from "@/hooks/use-post-insights";
import { formatCaptured, type GridVersion } from "@/lib/instagram/gridVersions";
import { VersionGrid } from "./VersionGrid";

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function Delta({
  label, before, after, digits = 0,
}: {
  label: string;
  before: number | null;
  after: number | null;
  digits?: number;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("es-CL", { maximumFractionDigits: digits });
  if (before == null || after == null) {
    return (
      <div className="rounded-xl border bg-surface px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm mt-1">Sin datos suficientes</p>
      </div>
    );
  }
  const diff = after - before;
  const pct = before > 0 ? (diff / before) * 100 : null;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const tone = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-muted-foreground";
  return (
    <div className="rounded-xl border bg-surface px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1 flex items-center gap-1.5">
        {fmt(before)}
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        {fmt(after)}
      </p>
      <p className={`text-xs mt-0.5 flex items-center gap-1 ${tone}`}>
        <Icon className="w-3 h-3" />
        {diff > 0 ? "+" : ""}
        {fmt(diff)}
        {pct != null ? ` (${diff > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}
      </p>
    </div>
  );
}

export function VersionCompare({
  clientId,
  posts,
  versions,
  leftId,
  rightId,
  onLeft,
  onRight,
}: {
  clientId: string;
  posts: IGPost[];
  versions: GridVersion[];
  leftId: string | null;
  rightId: string | null;
  onLeft: (id: string) => void;
  onRight: (id: string) => void;
}) {
  const { metrics } = usePostInsights(clientId);
  const left = versions.find((v) => v.id === leftId) ?? null;
  const right = versions.find((v) => v.id === rightId) ?? null;

  const stats = useMemo(() => {
    const of = (id: string | null) => {
      const rows = posts.filter((p) => p.version_id === id);
      const withMetrics = rows
        .map((p) => (p.ig_media_id ? metrics[p.ig_media_id] : undefined))
        .filter(Boolean) as { engagement: number; reach: number }[];
      return {
        count: rows.length,
        engagement: avg(withMetrics.map((m) => m.engagement)),
        reach: avg(withMetrics.map((m) => m.reach)),
      };
    };
    return { left: of(leftId), right: of(rightId) };
  }, [posts, metrics, leftId, rightId]);

  if (versions.length < 2) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border bg-surface px-4 py-6 text-center">
        Necesitas al menos dos versiones para comparar. Crea una nueva con "Capturar estado actual"
        o "Subir manualmente".
      </p>
    );
  }

  const picker = (value: string | null, onChange: (id: string) => void) => (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-sm">
        <SelectValue placeholder="Elige versión" />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.label} · {formatCaptured(v.captured_at)}
            {v.is_baseline ? " · Estado inicial" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Antes y después del trabajo realizado</h3>
        <p className="text-xs text-muted-foreground">
          {left && right
            ? `${left.label} (${formatCaptured(left.captured_at)}) comparado con ${right.label} (${formatCaptured(right.captured_at)})`
            : "Elige dos versiones para comparar"}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Delta label="Seguidores" before={left?.followers ?? null} after={right?.followers ?? null} />
        <Delta label="Publicaciones" before={stats.left.count} after={stats.right.count} />
        <Delta label="Interacción promedio" before={stats.left.engagement} after={stats.right.engagement} digits={1} />
        <Delta label="Alcance promedio" before={stats.left.reach} after={stats.right.reach} digits={1} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Antes</p>
          {picker(leftId, onLeft)}
          <VersionGrid clientId={clientId} posts={posts.filter((p) => p.version_id === leftId)} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Después</p>
          {picker(rightId, onRight)}
          <VersionGrid clientId={clientId} posts={posts.filter((p) => p.version_id === rightId)} />
        </div>
      </div>
    </div>
  );
}
