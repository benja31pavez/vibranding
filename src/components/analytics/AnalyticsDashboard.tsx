import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  ArrowUpDown,
} from "lucide-react";
import {
  clp,
  num,
  pct,
  duration,
  delta,
  safeRatio,
  isoDate,
  DOW_LABELS,
  type Analytics,
  type Campaign,
} from "./analytics-utils";
import { WhatWorks } from "./WhatWorks";

type Preset = "7d" | "30d" | "custom";

function useRange() {
  const [preset, setPreset] = useState<Preset>("30d");
  const today = new Date();
  const defaultTo = isoDate(today);
  const defaultFrom = isoDate(new Date(today.getTime() - 29 * 86400000));
  const [customFrom, setCustomFrom] = useState(defaultFrom);
  const [customTo, setCustomTo] = useState(defaultTo);

  const { from, to } = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    const days = preset === "7d" ? 7 : 30;
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    return { from: isoDate(start), to: isoDate(end) };
  }, [preset, customFrom, customTo]);

  return { preset, setPreset, from, to, customFrom, setCustomFrom, customTo, setCustomTo };
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function DeltaBadge({
  value,
  lowerIsBetter = false,
}: {
  value: number | null;
  lowerIsBetter?: boolean;
}) {
  if (value == null) {
    return <span className="text-[11px] text-muted-foreground">sin comparación</span>;
  }
  const good = lowerIsBetter ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.0001;
  const Icon = value >= 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
        flat
          ? "text-muted-foreground"
          : good
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-destructive"
      }`}
    >
      <Icon className="h-3 w-3" />
      {pct(Math.abs(value))} vs. periodo anterior
    </span>
  );
}

function KpiCard({
  title,
  value,
  hint,
  deltaValue,
  lowerIsBetter,
  empty,
}: {
  title: string;
  value: string;
  hint?: string;
  deltaValue: number | null;
  lowerIsBetter?: boolean;
  empty?: React.ReactNode | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {empty ? (
          <Empty>{empty}</Empty>
        ) : (
          <>
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
            {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
            <DeltaBadge value={deltaValue} lowerIsBetter={lowerIsBetter} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BackfillLink({ clientId }: { clientId: string }) {
  return (
    <Link
      to="/clients/$clientId/backfill"
      params={{ clientId }}
      className="font-medium underline underline-offset-2 hover:text-foreground"
    >
      marcar resultados ahora
    </Link>
  );
}

export function AnalyticsDashboard({ clientId }: { clientId: string }) {
  const r = useRange();
  const [sortKey, setSortKey] = useState<keyof Campaign | "cost_per_qualified">("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-analytics", clientId, r.from, r.to],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("client_analytics", {
        _client_id: clientId,
        _from: r.from,
        _to: r.to,
      });
      if (error) throw error;
      return data as Analytics;
    },
  });

  const f = data?.funnel;
  const fp = data?.funnel_prev;
  const answered = f?.answered ?? 0;
  const outcomesMissing = !!f && f.marked === 0;
  const unmarkedInPeriod = f ? Math.max(f.started - f.marked, 0) : 0;
  /** Specific, actionable empty state: never render a 0 as a measurement. */
  const unmarkedNote =
    unmarkedInPeriod > 0 ? (
      <>
        {num(unmarkedInPeriod)} conversación{unmarkedInPeriod === 1 ? "" : "es"} sin marcar en este
        periodo, así que esta métrica no es medible todavía · <BackfillLink clientId={clientId} />
      </>
    ) : null;

  const costPerQualified = safeRatio(data?.spend, f?.qualified || null);
  const costPerQualifiedPrev = safeRatio(data?.spend_prev, fp?.qualified || null);
  const cac = safeRatio(data?.spend, f?.closed || null);
  const cacPrev = safeRatio(data?.spend_prev, fp?.closed || null);
  const roas = safeRatio(f?.value_clp, data?.spend || null);
  const roasPrev = safeRatio(fp?.value_clp, data?.spend_prev || null);
  const median = data?.response_time?.median_seconds ?? null;
  const medianPrev = data?.response_time_prev?.median_seconds ?? null;

  const campaigns = useMemo(() => {
    const rows = (data?.campaigns ?? []).map((c) => ({
      ...c,
      cost_per_qualified: safeRatio(c.spend, c.qualified || null),
    }));
    return rows.sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        return sortAsc
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [data?.campaigns, sortKey, sortAsc]);

  const heat = useMemo(() => {
    const map = new Map<string, { median: number | null; sample: number }>();
    for (const c of data?.heatmap ?? []) {
      map.set(`${c.dow}-${c.hour}`, { median: c.median_seconds, sample: c.sample });
    }
    const values = (data?.heatmap ?? [])
      .map((c) => c.median_seconds)
      .filter((v): v is number => v != null);
    return {
      map,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    };
  }, [data?.heatmap]);

  const heatColor = (median: number | null) => {
    if (median == null || heat.min == null || heat.max == null) return "bg-muted/40";
    const span = heat.max - heat.min || 1;
    const t = (median - heat.min) / span;
    if (t < 0.2) return "bg-emerald-500/90 text-white";
    if (t < 0.4) return "bg-emerald-400/70";
    if (t < 0.6) return "bg-amber-400/70";
    if (t < 0.8) return "bg-orange-500/80 text-white";
    return "bg-destructive/85 text-white";
  };

  const sortBtn = (key: keyof Campaign | "cost_per_qualified", label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else {
          setSortKey(key);
          setSortAsc(false);
        }
      }}
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );

  const steps = f
    ? [
        { label: "Conversaciones iniciadas", value: f.started, prev: null as number | null },
        { label: "Respondidas", value: answered, prev: f.started },
        { label: "Calificadas", value: f.qualified, prev: answered },
        { label: "Cerradas", value: f.closed, prev: f.qualified },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analítica</h1>
          <p className="text-sm text-muted-foreground">
            {r.from} → {r.to} · comparado con el periodo anterior equivalente
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["7d", "30d", "custom"] as Preset[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={r.preset === p ? "default" : "outline"}
              onClick={() => r.setPreset(p)}
            >
              {p === "7d" ? "7 días" : p === "30d" ? "30 días" : "Personalizado"}
            </Button>
          ))}
          {r.preset === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={r.customFrom}
                max={r.customTo}
                onChange={(e) => r.setCustomFrom(e.target.value)}
                className="h-9 w-[9.5rem]"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="date"
                value={r.customTo}
                min={r.customFrom}
                onChange={(e) => r.setCustomTo(e.target.value)}
                className="h-9 w-[9.5rem]"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando métricas…
        </div>
      )}
      {error && (
        <Empty>No se pudieron cargar las métricas: {(error as Error).message}</Empty>
      )}

      {data && (
        <>
          {/* 1 — Funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Embudo de conversación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {f!.started === 0 ? (
                <Empty>
                  No hay conversaciones de WhatsApp iniciadas en este periodo, así que el embudo
                  no tiene nada que medir.
                </Empty>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    {steps.map((s, i) => {
                      const conv = s.prev ? safeRatio(s.value, s.prev) : null;
                      const unmeasured = i > 0 && outcomesMissing;
                      return (
                        <div key={s.label} className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground">{s.label}</div>
                          {unmeasured ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Sin marcar
                            </div>
                          ) : (
                            <>
                              <div className="text-2xl font-semibold">{num(s.value)}</div>
                              {conv != null && (
                                <div className="text-[11px] text-muted-foreground">
                                  {pct(conv)} del paso anterior
                                </div>
                              )}
                            </>
                          )}
                          <div
                            className="mt-2 h-1.5 rounded-full bg-primary/80"
                            style={{
                              width: `${
                                f!.started > 0 && !unmeasured
                                  ? Math.max((s.value / f!.started) * 100, 2)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {unmarkedInPeriod > 0 && (
                    <Empty>
                      {num(unmarkedInPeriod)} conversación{unmarkedInPeriod === 1 ? "" : "es"} sin
                      marcar en este periodo (de {num(f!.started)} iniciadas), así que los pasos
                      Respondida / Calificada / Cerrada están incompletos ·{" "}
                      <BackfillLink clientId={clientId} />
                    </Empty>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 2 — KPIs */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Costo por conversación calificada"
              value={costPerQualified != null ? clp(costPerQualified) : "—"}
              hint={`${num(f!.qualified)} calificadas · ${clp(data.spend)} de inversión`}
              deltaValue={delta(costPerQualified, costPerQualifiedPrev)}
              lowerIsBetter
              empty={
                !data.has_spend_data
                  ? "Sin datos de inversión de Meta en este periodo."
                  : outcomesMissing || f!.qualified === 0
                    ? (unmarkedNote ??
                      "Ninguna conversación fue marcada como calificada, así que este costo no se puede calcular.")
                    : null
              }
            />
            <KpiCard
              title="CAC real (inversión / cerradas)"
              value={cac != null ? clp(cac) : "—"}
              hint={`${num(f!.closed)} cerradas`}
              deltaValue={delta(cac, cacPrev)}
              lowerIsBetter
              empty={
                !data.has_spend_data
                  ? "Sin datos de inversión de Meta en este periodo."
                  : f!.closed === 0
                    ? (unmarkedNote ?? "Todavía no hay conversaciones marcadas como cerradas.")
                    : null
              }
            />
            <KpiCard
              title="ROAS (valor cerrado / inversión)"
              value={roas != null ? `${roas.toFixed(2)}×` : "—"}
              hint={`${clp(f!.value_clp)} cerrados`}
              deltaValue={delta(roas, roasPrev)}
              empty={
                !data.has_spend_data
                  ? "Sin datos de inversión de Meta en este periodo."
                  : (f!.closed_with_value ?? 0) === 0
                    ? (unmarkedNote ??
                      "Ningún cierre tiene valor en CLP registrado, así que el ROAS no es medible.")
                    : null
              }
            />
            <KpiCard
              title="Tiempo mediano de primera respuesta"
              value={duration(median)}
              hint={`${num(data.response_time?.sample ?? 0)} conversaciones respondidas`}
              deltaValue={delta(median, medianPrev)}
              lowerIsBetter
              empty={
                median == null
                  ? "Ninguna conversación de este periodo tiene una primera respuesta registrada."
                  : null
              }
            />
          </div>

          {/* 3 — Campaigns */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Campañas</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <Empty>
                  Sin datos de campañas para este rango. Conecta la cuenta de Meta o espera la
                  descarga diaria de métricas.
                </Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="py-2 text-left">{sortBtn("campaign_name", "Campaña")}</th>
                        <th className="py-2 text-right">{sortBtn("spend", "Inversión")}</th>
                        <th className="py-2 text-right">
                          {sortBtn("conversations_started", "Conv. iniciadas")}
                        </th>
                        <th className="py-2 text-right">{sortBtn("qualified", "Calificadas")}</th>
                        <th className="py-2 text-right">{sortBtn("closed", "Cerradas")}</th>
                        <th className="bg-primary/10 py-2 text-right">
                          {sortBtn("cost_per_qualified", "Costo por calificada")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => (
                        <tr key={c.campaign_id} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            {c.campaign_name ?? c.campaign_id}
                            {c.marked === 0 && c.attributed > 0 && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">
                                sin resultados marcados
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 text-right">{clp(c.spend)}</td>
                          <td className="py-2 text-right">{num(c.conversations_started)}</td>
                          <td className="py-2 text-right">
                            {c.marked === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              num(c.qualified)
                            )}
                          </td>
                          <td className="py-2 text-right">
                            {c.marked === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              num(c.closed)
                            )}
                          </td>
                          <td className="bg-primary/10 py-2 text-right font-medium">
                            {c.cost_per_qualified != null ? (
                              clp(c.cost_per_qualified)
                            ) : (
                              <span
                                className="text-muted-foreground"
                                title="Sin conversaciones calificadas atribuidas a esta campaña"
                              >
                                sin medir
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4 — Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Tiempo de respuesta por día y hora (mediana)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data.heatmap ?? []).length === 0 ? (
                <Empty>
                  Sin primeras respuestas registradas en este periodo, no hay tiempos que
                  graficar.
                </Empty>
              ) : (
                <div className="space-y-2 overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div className="mb-1 flex gap-[2px] pl-10">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div
                          key={h}
                          className="w-[26px] text-center text-[9px] text-muted-foreground"
                        >
                          {h}
                        </div>
                      ))}
                    </div>
                    {DOW_LABELS.map((label, i) => (
                      <div key={label} className="mb-[2px] flex items-center gap-[2px]">
                        <div className="w-10 text-[10px] text-muted-foreground">{label}</div>
                        {Array.from({ length: 24 }, (_, h) => {
                          const cell = heat.map.get(`${i + 1}-${h}`);
                          return (
                            <div
                              key={h}
                              title={
                                cell
                                  ? `${label} ${h}:00 · ${duration(cell.median)} (${cell.sample} conv.)`
                                  : `${label} ${h}:00 · sin datos`
                              }
                              className={`h-6 w-[26px] rounded-[3px] ${heatColor(
                                cell?.median ?? null,
                              )}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Más rápido</span>
                    <span className="h-3 w-6 rounded bg-emerald-500/90" />
                    <span className="h-3 w-6 rounded bg-amber-400/70" />
                    <span className="h-3 w-6 rounded bg-destructive/85" />
                    <span>Más lento</span>
                    <span className="ml-2">· gris = sin datos</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5 — Organic posts */}
          <Card>
            <CardHeader className="pb-2">
              <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() => setPostsOpen((v) => !v)}
                aria-expanded={postsOpen}
              >
                <CardTitle className="text-base">Publicaciones orgánicas</CardTitle>
                {postsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </CardHeader>
            {postsOpen && (
              <CardContent>
                {(data.posts ?? []).length === 0 ? (
                  <Empty>
                    Sin métricas de publicaciones orgánicas en este periodo. Requiere la cuenta de
                    Instagram conectada.
                  </Empty>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.posts.map((p) => (
                      <a
                        key={p.post_id}
                        href={p.permalink ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex gap-3 rounded-lg border p-3 transition hover:bg-muted/50"
                      >
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] uppercase text-muted-foreground">
                          {p.media_type ?? "post"}
                        </div>
                        <div className="min-w-0 text-xs">
                          <div className="truncate font-medium">{p.post_id}</div>
                          <div className="mt-1 text-muted-foreground">
                            Alcance {num(p.reach)}
                          </div>
                          <div className="text-muted-foreground">
                            Interacciones {num(p.engagement)}
                          </div>
                          <div className="text-muted-foreground">Guardados {num(p.saves)}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* 6 — Qué funciona */}
          <WhatWorks clientId={clientId} from={r.from} to={r.to} />

        </>
      )}
    </div>
  );
}
