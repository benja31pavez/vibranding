import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Info, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  refreshAudienceSnapshot,
  audienceMethodology,
} from "@/lib/meta/audience.functions";
import { num, pct } from "./analytics-utils";

const MIN_FOLLOWERS = 100;
const STALE_DAYS = 14;
const LOW_COVERAGE = 0.6;

type Row = {
  date: string;
  breakdown: string;
  key: string;
  value: number;
  followers_total: number | null;
  breakdown_total: number | null;
  coverage: number | null;
};

const BREAKDOWN_UNIT: Record<string, string> = {
  age: "seguidores con dato de edad",
  gender: "seguidores con dato de género",
  country: "seguidores con dato de país",
  city: "seguidores con dato de ciudad",
  age_gender: "seguidores con dato de edad y género",
};

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(`${iso}T00:00:00Z`).getTime()) / 86400000);
}

/**
 * Permanent, non-dismissible provenance panel. Exported so the same
 * explanation travels with the numbers in any shared client report.
 */
export function AudienceDisclosure({
  date,
  covered,
  followers,
  unit = "seguidores con datos demográficos",
}: {
  date: string;
  covered: number;
  followers: number;
  unit?: string;
}) {
  const coverage = followers > 0 ? covered / followers : null;
  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Info className="h-4 w-4" /> Sobre estos datos
      </div>
      <p>
        Fuente: Instagram Graph API de Meta (métrica <code>follower_demographics</code>),
        consultada el {fmtDate(date)}. Cobertura: {num(covered)} de {num(followers)} seguidores (
        {coverage == null ? "—" : pct(coverage)}). Instagram no incluye en estos agregados a las
        cuentas privadas ni a los seguidores sin datos demográficos declarados o inferidos. Por eso
        la suma de las categorías es menor que el total de seguidores. No es un error de medición:
        es cómo Meta entrega la información. Instagram tampoco entrega la lista de seguidores, solo
        agregados anónimos.
      </p>
      <p className="text-muted-foreground">Base de los porcentajes: {unit}.</p>
      {coverage != null && coverage < LOW_COVERAGE && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          La cobertura es de {pct(coverage)}: la muestra es lo bastante pequeña como para que la
          distribución pueda no representar a toda la audiencia.
        </p>
      )}
    </div>
  );
}

function Bars({
  rows,
  total,
  unit,
  limit = 10,
}: {
  rows: Row[];
  total: number;
  unit: string;
  limit?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const max = rows[0]?.value ?? 1;
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {shown.map((r) => (
          <div key={r.key} className="text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{r.key}</span>
              <span className="shrink-0 text-muted-foreground">
                {num(r.value)} · {total > 0 ? pct(r.value / total) : "—"}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Eje: {unit}</span>
        {rows.length > limit && (
          <button type="button" className="underline" onClick={() => setAll((v) => !v)}>
            {all ? "ver menos" : `ver todos (${rows.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

const AGE_GENDER_COLORS = ["bg-primary", "bg-accent", "bg-muted-foreground/60"];

function AgeGenderStack({ rows, total }: { rows: Row[]; total: number }) {
  const { ages, genders, matrix } = useMemo(() => {
    const ageSet: string[] = [];
    const genderSet: string[] = [];
    const m = new Map<string, number>();
    for (const r of rows) {
      const parts = r.key.split(" · ");
      // Meta returns the pair as "age · gender" or "gender · age" depending on order.
      const age = parts.find((p) => /\d/.test(p)) ?? parts[0];
      const gender = parts.find((p) => p !== age) ?? "desconocido";
      if (!ageSet.includes(age)) ageSet.push(age);
      if (!genderSet.includes(gender)) genderSet.push(gender);
      m.set(`${age}|${gender}`, (m.get(`${age}|${gender}`) ?? 0) + r.value);
    }
    ageSet.sort();
    return { ages: ageSet, genders: genderSet, matrix: m };
  }, [rows]);

  const maxAge = Math.max(
    ...ages.map((a) => genders.reduce((s, g) => s + (matrix.get(`${a}|${g}`) ?? 0), 0)),
    1,
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-[11px]">
        {genders.map((g, i) => (
          <span key={g} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${AGE_GENDER_COLORS[i % 3]}`} /> {g}
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {ages.map((a) => {
          const sum = genders.reduce((s, g) => s + (matrix.get(`${a}|${g}`) ?? 0), 0);
          return (
            <div key={a} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{a}</span>
                <span className="text-muted-foreground">
                  {num(sum)} · {total > 0 ? pct(sum / total) : "—"}
                </span>
              </div>
              <div
                className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted"
                style={{ width: `${Math.max((sum / maxAge) * 100, 2)}%` }}
              >
                {genders.map((g, i) => {
                  const v = matrix.get(`${a}|${g}`) ?? 0;
                  if (!v) return null;
                  return (
                    <div
                      key={g}
                      className={AGE_GENDER_COLORS[i % 3]}
                      style={{ width: `${(v / sum) * 100}%` }}
                      title={`${a} · ${g}: ${num(v)}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Eje: {BREAKDOWN_UNIT.age_gender}
      </p>
    </div>
  );
}

export function AudiencePanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const refresh = useServerFn(refreshAudienceSnapshot);
  const methodologyFn = useServerFn(audienceMethodology);
  const [methodOpen, setMethodOpen] = useState(false);

  const followersQ = useQuery({
    queryKey: ["ig-followers", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_profiles")
        .select("current_followers,current_synced_at")
        .eq("client_id", clientId)
        .maybeSingle();
      return {
        followers: Number(data?.current_followers) || 0,
        syncedAt: data?.current_synced_at ?? null,
      };
    },
  });

  const snapshotQ = useQuery({
    queryKey: ["ig-audience", clientId],
    queryFn: async () => {
      const { data: last } = await supabase
        .from("instagram_audience_snapshots")
        .select("date")
        .eq("client_id", clientId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last?.date) return { date: null as string | null, rows: [] as Row[] };
      const { data } = await supabase
        .from("instagram_audience_snapshots")
        .select("date,breakdown,key,value,followers_total,breakdown_total,coverage")
        .eq("client_id", clientId)
        .eq("date", last.date)
        .order("value", { ascending: false });
      return { date: last.date, rows: (data ?? []) as Row[] };
    },
  });

  const methodQ = useQuery({ queryKey: ["ig-audience-method"], queryFn: () => methodologyFn({}) });

  const sync = useMutation({
    mutationFn: () => refresh({ data: { clientId, force: true } }),
    onSuccess: (res: any) => {
      if (!res?.ok) return toast.error(res?.reason ?? "No se pudo consultar Meta");
      if (res.skipped === "recent") toast.info("Ya existe una instantánea de esta semana");
      else toast.success(`Instantánea guardada (${res.rowsWritten} filas)`);
      qc.invalidateQueries({ queryKey: ["ig-audience", clientId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al consultar Meta"),
  });

  const followers = followersQ.data?.followers ?? 0;

  if (followersQ.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (followers < MIN_FOLLOWERS) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audiencia</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Instagram entrega datos demográficos solo para cuentas con {MIN_FOLLOWERS} seguidores o
          más. Esta cuenta tiene {num(followers)}. La sección se activará sola cuando supere ese
          umbral.
        </CardContent>
      </Card>
    );
  }

  const rows = snapshotQ.data?.rows ?? [];
  const date = snapshotQ.data?.date ?? null;
  const group = (b: string) => rows.filter((r) => r.breakdown === b);
  const totalOf = (b: string) => group(b).reduce((s, r) => s + r.value, 0);
  const bestCoverage = Math.max(totalOf("country"), totalOf("age"), totalOf("gender"), 0);
  const stale = date ? daysSince(date) > STALE_DAYS : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          {date ? (
            <>
              Última instantánea: <strong>{fmtDate(date)}</strong>{" "}
              {stale && (
                <Badge variant="outline" className="ml-1 border-amber-500 text-amber-600">
                  hace {daysSince(date)} días — datos no vigentes
                </Badge>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Sin instantáneas todavía.</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          Actualizar demografía
        </Button>
      </div>

      {stale && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          La última instantánea tiene más de {STALE_DAYS} días. Los datos que ves abajo corresponden
          al {fmtDate(date!)} y pueden no reflejar la audiencia actual.
        </div>
      )}

      {date && <AudienceDisclosure date={date} covered={bestCoverage} followers={followers} />}

      {!date ? (
        <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Aún no hay datos demográficos guardados para este cliente. Usa «Actualizar demografía»
          para tomar la primera instantánea.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Género</CardTitle>
            </CardHeader>
            <CardContent>
              <Bars rows={group("gender")} total={totalOf("gender")} unit={BREAKDOWN_UNIT.gender} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edad</CardTitle>
            </CardHeader>
            <CardContent>
              <Bars rows={group("age")} total={totalOf("age")} unit={BREAKDOWN_UNIT.age} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Género por edad</CardTitle>
            </CardHeader>
            <CardContent>
              {group("age_gender").length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Meta no entregó el cruce edad × género para esta cuenta.
                </p>
              ) : (
                <AgeGenderStack rows={group("age_gender")} total={totalOf("age_gender")} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">País</CardTitle>
            </CardHeader>
            <CardContent>
              <Bars
                rows={group("country")}
                total={totalOf("country")}
                unit={BREAKDOWN_UNIT.country}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ciudad</CardTitle>
            </CardHeader>
            <CardContent>
              <Bars rows={group("city")} total={totalOf("city")} unit={BREAKDOWN_UNIT.city} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setMethodOpen((v) => !v)}
            aria-expanded={methodOpen}
          >
            <CardTitle className="text-base">Metodología</CardTitle>
            {methodOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CardHeader>
        {methodOpen && (
          <CardContent className="space-y-1.5 text-xs text-muted-foreground">
            <p>
              Versión de la API: <strong>{methodQ.data?.graphVersion ?? "—"}</strong> (Instagram
              Graph API de Meta).
            </p>
            <p>
              Métrica consultada: <code>{methodQ.data?.metric ?? "follower_demographics"}</code>,
              periodo <code>lifetime</code>, ventana{" "}
              <code>{methodQ.data?.timeframe ?? "last_30_days"}</code>, desglosada por{" "}
              {(methodQ.data?.breakdowns ?? ["age", "gender", "country", "city", "age,gender"]).join(
                ", ",
              )}
              .
            </p>
            <p>
              Frecuencia de la instantánea: cada {methodQ.data?.intervalDays ?? 7} días. La
              demografía cambia lentamente, así que registrarla a diario solo gastaría cuota de API.
            </p>
            <p>
              Meta puede recalcular, corregir o retener valores después de publicarlos, y omite
              categorías con muy pocos seguidores para proteger la privacidad. Por eso una cifra
              puede variar entre instantáneas.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
