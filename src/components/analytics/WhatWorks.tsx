import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ExternalLink, Info, Loader2 } from "lucide-react";
import { num, pct, DOW_LABELS } from "./analytics-utils";
import { useZeroCause } from "@/hooks/use-zero-cause";

type Bucket = { median_engagement: number | null; sample: number };
type HourRow = Bucket & { hour: number };
type DowRow = Bucket & { dow: number };
type FormatRow = Bucket & {
  format: string | null;
  avg_engagement: number | null;
  avg_reach: number | null;
  avg_saves: number | null;
};
type ObjectiveRow = Bucket & {
  objective: string | null;
  avg_engagement: number | null;
  avg_reach: number | null;
};
type RankedPost = {
  post_id: string;
  permalink: string | null;
  thumb: string | null;
  caption: string | null;
  format: string | null;
  objective: string | null;
  reach: number;
  engagement: number;
  saves: number;
  at: string | null;
};

export type ContentPerformance = {
  range: { from: string; to: string };
  timezone: string;
  followers: number | null;
  has_meta_account: boolean;
  synced_media_count: number;
  insight_post_count: number;
  matched_post_count: number;
  objective_post_count: number;
  by_hour: HourRow[];
  by_dow: DowRow[];
  by_format: FormatRow[];
  by_objective: ObjectiveRow[];
  top: RankedPost[];
  bottom: RankedPost[];
  series: { date: string; engagement: number; reach: number; posts: number }[];
};

const MIN_POSTS = 10;

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

const FORMAT_LABELS: Record<string, string> = {
  reel: "Reel",
  video: "Reel / video",
  carousel: "Carrusel",
  carousel_album: "Carrusel",
  photo: "Imagen",
  image: "Imagen",
};

const formatLabel = (f: string | null) =>
  f ? (FORMAT_LABELS[f.toLowerCase()] ?? f) : "Sin formato";

/**
 * Returns the blocking empty state for a panel, or null when it has enough data.
 * Never render zeros or a flat line when the cause is missing data.
 */
function blocker(
  d: ContentPerformance,
  needMinPosts = true,
  mediaReason?: string,
): React.ReactNode | null {
  if (!d.has_meta_account) {
    return (
      mediaReason ??
      "No hay una cuenta de Meta/Instagram conectada para este cliente, así que no existen métricas reales que analizar."
    );
  }
  if (d.synced_media_count === 0) {
    return (
      mediaReason ??
      "La cuenta está conectada pero todavía no se han sincronizado publicaciones reales de Instagram (sin ig_media_id)."
    );
  }
  if (d.insight_post_count === 0) {
    return (
      mediaReason ??
      "No hay publicaciones con métricas en este periodo. Amplía el rango de fechas o sincroniza Instagram."
    );
  }
  if (needMinPosts && d.insight_post_count < MIN_POSTS) {
    return `Solo ${d.insight_post_count} publicación${d.insight_post_count === 1 ? "" : "es"} con métricas en este periodo: se necesitan al menos ${MIN_POSTS} para que la mediana sea confiable.`;
  }
  return null;
}

function Bars({
  rows,
}: {
  rows: { key: string; label: string; value: number | null; sample: number; note?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value ?? 0), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground">
              {r.value == null ? "—" : num(Math.round(r.value))} · {r.sample} pub.
              {r.note ? ` · ${r.note}` : ""}
            </span>
          </div>
          <div className="h-2 rounded bg-muted">
            <div
              className="h-2 rounded bg-primary"
              style={{ width: `${((r.value ?? 0) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PostList({ posts, tone }: { posts: RankedPost[]; tone: "top" | "bottom" }) {
  return (
    <div className="space-y-2">
      {posts.map((p, i) => (
        <div key={p.post_id} className="flex items-start gap-3 rounded-lg border p-2">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {p.thumb ? (
              <img
                src={p.thumb}
                alt={p.caption?.slice(0, 60) || `Publicación ${p.post_id}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[9px] uppercase text-muted-foreground">sin img</span>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant={tone === "top" ? "default" : "secondary"} className="text-[10px]">
                #{i + 1}
              </Badge>
              <span className="text-muted-foreground">{formatLabel(p.format)}</span>
              {p.objective && <span className="text-muted-foreground">· {p.objective}</span>}
            </div>
            <div className="mt-1 line-clamp-2 text-muted-foreground">
              {p.caption?.trim() || "Sin copy guardado"}
            </div>
            <div className="mt-1 font-medium">
              {num(p.engagement)} interacciones · {num(p.reach)} alcance · {num(p.saves)} guardados
            </div>
          </div>
          {p.permalink && (
            <a
              href={p.permalink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Abrir en Instagram"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function RateChart({ d }: { d: ContentPerformance }) {
  const points = useMemo(() => {
    if (!d.followers || d.followers <= 0) return [];
    return d.series.map((s) => ({ date: s.date, rate: s.engagement / d.followers! }));
  }, [d]);

  if (!d.followers || d.followers <= 0) {
    return (
      <Empty>
        Falta el número de seguidores del perfil (instagram_profiles.current_followers). Sincroniza
        el perfil de Instagram para calcular la tasa de interacción.
      </Empty>
    );
  }
  if (points.length < 2) {
    return (
      <Empty>
        Solo hay {points.length} día{points.length === 1 ? "" : "s"} con métricas en este periodo: no
        alcanza para dibujar una evolución.
      </Empty>
    );
  }

  const max = Math.max(...points.map((p) => p.rate));
  const min = Math.min(...points.map((p) => p.rate));
  const span = max - min || max || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((p.rate - min) / span) * 90 - 5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full">
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0]!.date}</span>
        <span>
          {pct(min)} – {pct(max)} sobre {num(d.followers)} seguidores
        </span>
        <span>{points[points.length - 1]!.date}</span>
      </div>
    </div>
  );
}

export function WhatWorks({
  clientId,
  from,
  to,
}: {
  clientId: string;
  from: string;
  to: string;
}) {
  const [open, setOpen] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ["content-performance", clientId, from, to],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("content_performance", {
        _client_id: clientId,
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return data as ContentPerformance;
    },
  });

  const bestHour = useMemo(() => {
    const rows = (data?.by_hour ?? []).filter((h) => h.median_engagement != null);
    return rows.sort((a, b) => (b.median_engagement ?? 0) - (a.median_engagement ?? 0))[0] ?? null;
  }, [data?.by_hour]);

  const bestDow = useMemo(() => {
    const rows = (data?.by_dow ?? []).filter((h) => h.median_engagement != null);
    return rows.sort((a, b) => (b.median_engagement ?? 0) - (a.median_engagement ?? 0))[0] ?? null;
  }, [data?.by_dow]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex w-full items-center justify-between"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <CardTitle className="text-base">Qué funciona</CardTitle>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando rendimiento de contenido…
            </div>
          )}
          {error && (
            <Empty>No se pudo cargar el rendimiento de contenido: {(error as Error).message}</Empty>
          )}
          {data && (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Best hour / weekday */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="text-sm font-medium">Mejor horario y día para publicar</div>
                {blocker(data, true, mediaReason) ? (
                  <Empty>{blocker(data, true, mediaReason)}</Empty>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Mejor hora</div>
                        <div className="text-xl font-semibold">
                          {bestHour ? `${String(bestHour.hour).padStart(2, "0")}:00` : "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {bestHour
                            ? `mediana ${num(Math.round(bestHour.median_engagement ?? 0))} · ${bestHour.sample} pub.`
                            : "sin fecha de publicación en las publicaciones"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Mejor día</div>
                        <div className="text-xl font-semibold">
                          {bestDow ? DOW_LABELS[bestDow.dow - 1] : "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {bestDow
                            ? `mediana ${num(Math.round(bestDow.median_engagement ?? 0))} · ${bestDow.sample} pub.`
                            : "sin fecha de publicación en las publicaciones"}
                        </div>
                      </div>
                    </div>
                    {data.by_dow.length === 0 ? (
                      <Empty>
                        Ninguna publicación con métricas tiene fecha de publicación registrada, así
                        que no se puede calcular horario ni día.
                      </Empty>
                    ) : (
                      <Bars
                        rows={data.by_dow.map((r) => ({
                          key: String(r.dow),
                          label: DOW_LABELS[r.dow - 1] ?? String(r.dow),
                          value: r.median_engagement,
                          sample: r.sample,
                        }))}
                      />
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      Horas en zona horaria {data.timezone}
                    </div>
                  </>
                )}
              </div>

              {/* Format & objective */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="text-sm font-medium">Rendimiento por formato y objetivo</div>
                {blocker(data, false, mediaReason) ? (
                  <Empty>{blocker(data, false, mediaReason)}</Empty>
                ) : (
                  <>
                    <div>
                      <div className="mb-1 text-[11px] uppercase text-muted-foreground">
                        Formato · mediana de interacciones
                      </div>
                      {data.by_format.length === 0 ? (
                        <Empty>
                          Las publicaciones con métricas no tienen formato asociado en el plan de
                          contenido (falta emparejarlas con su ig_media_id).
                        </Empty>
                      ) : (
                        <Bars
                          rows={data.by_format.map((r) => ({
                            key: r.format ?? "none",
                            label: formatLabel(r.format),
                            value: r.median_engagement,
                            sample: r.sample,
                            note: r.avg_reach != null ? `alcance ${num(Math.round(r.avg_reach))}` : undefined,
                          }))}
                        />
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] uppercase text-muted-foreground">
                        Objetivo · mediana de interacciones
                      </div>
                      {data.objective_post_count === 0 ? (
                        <Empty>
                          Ninguna publicación de este periodo tiene objetivo definido, así que no hay
                          nada que comparar.
                        </Empty>
                      ) : (
                        <Bars
                          rows={data.by_objective.map((r) => ({
                            key: r.objective ?? "none",
                            label: r.objective ?? "Sin objetivo",
                            value: r.median_engagement,
                            sample: r.sample,
                          }))}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Top / bottom posts */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="text-sm font-medium">Top 5 y peores 5 del periodo</div>
                {blocker(data, false, mediaReason) ? (
                  <Empty>{blocker(data, false, mediaReason)}</Empty>
                ) : data.insight_post_count < 2 ? (
                  <Empty>
                    Solo hay {data.insight_post_count} publicación con métricas: no hay ranking
                    posible.
                  </Empty>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-[11px] uppercase text-muted-foreground">
                        Mejores
                      </div>
                      <PostList posts={data.top} tone="top" />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] uppercase text-muted-foreground">Peores</div>
                      <PostList posts={data.bottom} tone="bottom" />
                    </div>
                  </div>
                )}
              </div>

              {/* Engagement rate over time */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="text-sm font-medium">
                  Tasa de interacción sobre seguidores en el tiempo
                </div>
                {blocker(data, false, mediaReason) ? <Empty>{blocker(data, false, mediaReason)}</Empty> : <RateChart d={data} />}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
