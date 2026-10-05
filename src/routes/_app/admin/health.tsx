import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, AlertTriangle, Bot, ChevronRight, CreditCard, Instagram, Plug, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, ListSkeleton, PageContainer } from "@/components/app";
import { useIsPlatformAdmin } from "@/lib/auth/platformAdmin.functions";
import { useFlowConfigured } from "@/lib/flow/config.functions";
import { getJobHealth, setJobSchedule, type JobHealthRow } from "@/lib/admin/health.functions";
import { getIgWebhookStatus } from "@/lib/instagram/webhook.functions";
import { listIgSyncRuns } from "@/lib/admin/igSyncLog.functions";

export const Route = createFileRoute("/_app/admin/health")({
  component: HealthPage,
  head: () => ({
    meta: [
      { title: "Estado del sistema · Vibranding" },
      {
        name: "description",
        content:
          "Panel interno de salud: última ejecución correcta de cada trabajo automático y fallos de las últimas 24 horas.",
      },
      { property: "og:title", content: "Estado del sistema · Vibranding" },
      {
        property: "og:description",
        content: "Salud de los trabajos automáticos de Vibranding.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STALE_HOURS = 25;

/** Frecuencias disponibles para el despachador del bot de WhatsApp. */
const DISPATCH_SCHEDULES: Array<{ label: string; value: string }> = [
  { label: "Cada 30 segundos", value: "30 seconds" },
  { label: "Cada minuto", value: "* * * * *" },
  { label: "Cada 2 minutos (recomendado)", value: "*/2 * * * *" },
  { label: "Cada 5 minutos", value: "*/5 * * * *" },
];

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "medium" });
}

/** Estados de job_runs en español. */
const RUN_STATUS_LABEL: Readonly<Record<string, string>> = {
  succeeded: "OK",
  failed: "Falló",
  running: "En curso",
  no_data: "Sin datos",
};
const runStatusLabel = (status: string) => RUN_STATUS_LABEL[status] ?? status;

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function isStale(job: JobHealthRow): boolean {
  const h = hoursSince(job.last_success);
  return h === null || h > STALE_HOURS;
}

/** Salud del sistema: solo administradores de plataforma (el servidor también lo exige). */
function HealthPage() {
  const admin = useIsPlatformAdmin();
  if (admin.isPending) {
    return (
      <PageContainer>
        <ListSkeleton rows={4} label="Comprobando permisos" />
      </PageContainer>
    );
  }
  if (admin.isError) {
    return (
      <PageContainer>
        <ErrorState message="No pudimos comprobar tus permisos." onRetry={() => void admin.refetch()} retrying={admin.isFetching} />
      </PageContainer>
    );
  }
  if (!admin.data) {
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldAlert}
          title="Solo para administradores"
          description="El estado del sistema y los diagnósticos de integraciones están disponibles solo para los administradores de la plataforma."
        />
      </PageContainer>
    );
  }
  return <HealthDashboard />;
}

function HealthDashboard() {
  const fetchHealth = useServerFn(getJobHealth);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["job-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 60_000,
  });

  const fetchIg = useServerFn(getIgWebhookStatus);
  const ig = useQuery({
    queryKey: ["ig-webhook-status"],
    queryFn: () => fetchIg(),
    refetchInterval: 300_000,
  });
  const igData = ig.data;

  const saveSchedule = useServerFn(setJobSchedule);
  const schedule = useMutation({
    mutationFn: saveSchedule,
    onSuccess: (res) => {
      if (res.ok) toast.success("Frecuencia actualizada");
      else toast.error("No se pudo cambiar la frecuencia: la tarea no existe en el programador.");
      void refetch();
    },
    onError: (e) => toast.error("No se pudo cambiar la frecuencia", { description: errorText(e, "Error inesperado") }),
  });
  const igBlocked =
    !!igData &&
    (!igData.publicOriginConfigured ||
      !igData.verifyTokenConfigured ||
      igData.publicOriginReachable === false);

  const jobs = data?.jobs ?? [];
  const staleJobs = jobs.filter(isStale);
  const failed24h = jobs.reduce((acc, j) => acc + Number(j.failed_24h ?? 0), 0);

  // Connected but empty: a connection that produces no data is not healthy.
  const connections = data?.connections ?? [];
  const emptyConnections = connections.filter(
    (c) =>
      (c.adAccountId && c.adInsightRows === 0) ||
      (c.igAccountId && c.syncedInstagramPosts === 0),
  );

  return (
    <PageContainer className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Estado del sistema</h1>
            <p className="text-sm text-muted-foreground">
              Trabajos automáticos: última ejecución correcta y fallos recientes.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </header>

      {staleJobs.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Trabajo detenido</AlertTitle>
          <AlertDescription>
            {staleJobs.map((j) => j.job_name).join(", ")} no registra una ejecución correcta en más
            de {STALE_HOURS} horas.
          </AlertDescription>
        </Alert>
      )}

      {emptyConnections.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Conexiones sin datos</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {emptyConnections.map((c) => (
                <li key={c.clientId}>
                  <span className="font-medium">{c.clientName ?? c.clientId}</span>:{" "}
                  {[
                    c.adAccountId && c.adInsightRows === 0
                      ? "cuenta publicitaria conectada sin ninguna fila en ad_insights_daily"
                      : null,
                    c.igAccountId && c.syncedInstagramPosts === 0
                      ? "Instagram vinculado sin publicaciones sincronizadas (ig_media_id)"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {c.lastSyncError ? ` · último error: ${c.lastSyncError}` : ""}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}


      {igBlocked && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Webhook de Instagram no operativo</AlertTitle>
          <AlertDescription>
            {!igData?.publicOriginConfigured
              ? "Falta el origen público canónico (PUBLIC_SITE_URL)."
              : igData?.publicOriginReachable === false
                ? "La URL pública no responde: la app debe estar publicada para que Meta pueda entregar los comentarios."
                : "Falta el token de verificación del webhook."}
          </AlertDescription>
        </Alert>
      )}

      {isError && (
        <ErrorState
          title="No se pudo leer el estado"
          message={errorText(error, "Error inesperado")}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      )}

      <DiagnosticsLinks />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trabajos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{jobs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fallos (24 h)
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`text-3xl font-semibold ${failed24h > 0 ? "text-destructive" : ""}`}
          >
            {failed24h}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Detenidos</CardTitle>
          </CardHeader>
          <CardContent
            className={`text-3xl font-semibold ${staleJobs.length > 0 ? "text-destructive" : ""}`}
          >
            {staleJobs.length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trabajos programados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <ListSkeleton rows={3} label="Cargando trabajos" />}
          {!isLoading && !isError && jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay trabajos registrados.</p>
          )}
          {jobs.map((j) => (
            <div
              key={j.job_name}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{j.job_name}</span>
                  {j.active === false && <Badge variant="secondary">Inactivo</Badge>}
                  {isStale(j) ? (
                    <Badge variant="destructive">Sin ejecución correcta</Badge>
                  ) : (
                    <Badge variant="default">OK</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Frecuencia: {j.schedule ?? "—"} · Última ejecución: {fmt(j.last_run)}
                </p>
              </div>
              <div className="text-right text-xs">
                <div>
                  Última correcta:{" "}
                  <span className="font-medium">{fmt(j.last_success)}</span>
                </div>
                <div className={Number(j.failed_24h) > 0 ? "text-destructive" : ""}>
                  {Number(j.failed_24h)} fallos / {Number(j.total_24h)} ejecuciones (24 h)
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automatización de Instagram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {ig.isLoading && <ListSkeleton rows={2} label="Cargando estado de Instagram" />}
          {ig.isError && (
            <ErrorState
              message={errorText(ig.error, "No se pudo leer el estado de Instagram.")}
              onRetry={() => void ig.refetch()}
              retrying={ig.isFetching}
            />
          )}
          {igData && (
            <>
              <div className="rounded-lg border p-3 space-y-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">URL del webhook:</span>
                  <code className="bg-secondary px-1.5 py-0.5 rounded">
                    {igData.callbackUrl ?? "sin configurar"}
                  </code>
                  {igData.publicOriginReachable === true ? (
                    <Badge variant="default">Publicada y accesible</Badge>
                  ) : igData.publicOriginReachable === false ? (
                    <Badge variant="destructive">No accesible — publica la app</Badge>
                  ) : (
                    <Badge variant="secondary">Sin verificar</Badge>
                  )}
                </div>
                <div>
                  Token de verificación:{" "}
                  {igData.verifyTokenConfigured ? "configurado" : "FALTA"}
                </div>
                <div>
                  Comentarios procesados (24 h): {igData.eventsLast24h} · fallidos:{" "}
                  <span className={igData.failedLast24h > 0 ? "text-destructive" : ""}>
                    {igData.failedLast24h}
                  </span>{" "}
                  · último evento: {fmt(igData.lastCommentEventAt)}
                </div>
              </div>

              {igData.clients.length === 0 && (
                <p className="text-muted-foreground text-xs">No hay clientes visibles.</p>
              )}
              {igData.clients.map((c) => (
                <div
                  key={c.clientId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.clientName}</span>
                      {!c.igAccountId ? (
                        <Badge variant="secondary">Sin Instagram vinculado</Badge>
                      ) : c.subscribed ? (
                        <Badge variant="default">Suscrito a comentarios</Badge>
                      ) : (
                        <Badge variant="destructive">Sin suscripción</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.activeTriggers} automatización(es) activa(s)
                      {c.subscribedFields.length > 0
                        ? ` · campos: ${c.subscribedFields.join(", ")}`
                        : ""}
                      {c.error ? ` · ${c.error}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frecuencia del bot de WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Actual:{" "}
            <code className="bg-secondary px-1.5 py-0.5 rounded">
              {(data?.jobs ?? []).find((j) => j.job_name === "whatsapp_ai_dispatch")?.schedule ??
                "—"}
            </code>{" "}
            · Más frecuencia = respuestas más rápidas, pero más despertares de la base de datos y
            por lo tanto mayor costo de cómputo. Menos frecuencia = más latencia en la respuesta al
            cliente y menor costo.
          </p>
          <div className="flex flex-wrap gap-2">
            {DISPATCH_SCHEDULES.map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant="outline"
                disabled={schedule.isPending}
                onClick={() =>
                  schedule.mutate({
                    data: { jobName: "whatsapp_ai_dispatch", schedule: s.value },
                  })
                }
              >
                {s.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas ejecuciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <ListSkeleton rows={3} label="Cargando ejecuciones" />}
          {!isLoading && !isError && (data?.recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin registros todavía.</p>
          )}
          {(data?.recent ?? []).map((r) => {
            const noData = r.status === "no_data" || (r.rows_written != null && r.rows_written === 0);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 text-sm"
              >
                <span className="font-mono text-xs">{r.job_name}</span>
                <span className="text-xs text-muted-foreground">{fmt(r.started_at)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {r.rows_written == null ? "filas: —" : `${r.rows_written} filas`}
                  </span>
                  {r.http_status != null && (
                    <span className="text-xs text-muted-foreground">HTTP {r.http_status}</span>
                  )}
                  {r.status === "failed" ? (
                    <Badge variant="destructive">Falló</Badge>
                  ) : noData ? (
                    <Badge className="bg-amber-500 text-white hover:bg-amber-500">Sin datos</Badge>
                  ) : (
                    <Badge variant={r.status === "succeeded" ? "default" : "secondary"}>
                      {runStatusLabel(r.status)}
                    </Badge>
                  )}
                </div>
                {r.error && <p className="w-full text-xs text-destructive break-all">{r.error}</p>}
                {(r.status === "failed" || noData) && r.response_body && (
                  <pre className="w-full max-h-48 overflow-auto rounded bg-secondary p-2 text-[11px] leading-snug whitespace-pre-wrap break-all">
                    {r.response_body}
                  </pre>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <IgSyncLogCard />
    </PageContainer>

  );
}

/** Audit trail of Instagram sync runs: label swapped, media count and errors. */
function IgSyncLogCard() {
  const fetchRuns = useServerFn(listIgSyncRuns);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["ig-sync-runs"],
    queryFn: () => fetchRuns(),
    refetchInterval: 120_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Instagram className="h-4 w-4" /> Sincronizaciones de Instagram
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} aria-label="Actualizar sincronizaciones">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <ListSkeleton rows={3} label="Cargando sincronizaciones" />}
        {isError && (
          <ErrorState
            message={errorText(error, "No se pudieron leer las sincronizaciones.")}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}
        {!isLoading && !isError && (data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay sincronizaciones registradas.</p>
        )}
        {(data ?? []).map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-0"
          >
            <span className="font-medium">{r.client_name ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
            <span className="text-xs text-muted-foreground">
              versión: {r.persisted_label ?? r.requested_label ?? "—"}
              {r.swapped && " (reemplazada)"}
              {r.is_baseline && " (estado inicial)"}
            </span>
            <span className="text-xs text-muted-foreground">
              {r.media_count == null ? "publicaciones: —" : `${r.media_count} publicaciones`}
            </span>
            {r.status === "error" ? (
              <Badge variant="destructive">Error</Badge>
            ) : (
              <Badge variant="default">OK</Badge>
            )}
            {r.note && <p className="w-full text-xs text-muted-foreground">{r.note}</p>}
            {r.error && <p className="w-full text-xs text-destructive break-all">{r.error}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Diagnósticos de integraciones (Meta y Flow) agrupados dentro de Salud. */
function DiagnosticsLinks() {
  const flow = useFlowConfigured();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Integraciones</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/admin/automatizaciones"
          className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
        >
          <Bot aria-hidden className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            <span className="block font-medium">Automatizaciones</span>
            <span className="block text-xs text-muted-foreground">Alertas, reportes, cobros e ingestas: última ejecución y resultado, en simple.</span>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/admin/meta-diagnostics"
          className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plug aria-hidden className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            <span className="block font-medium">Diagnóstico de Meta</span>
            <span className="block text-xs text-muted-foreground">Credenciales, permisos y prueba de ingesta.</span>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div id="flow" className="flex items-center gap-3 rounded-lg border p-3 text-sm">
          <CreditCard aria-hidden className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            <span className="block font-medium">Flow (cobros online)</span>
            <span className="block text-xs text-muted-foreground">
              {flow.isPending
                ? "Comprobando…"
                : flow.isError
                  ? "No se pudo comprobar."
                  : flow.data?.configured
                    ? "Configurado: se pueden generar links de pago."
                    : `No configurado${flow.data?.missing?.length ? `: falta ${flow.data.missing.join(", ")}` : ""}. FLOW_API_URL debe ser https://www.flow.cl/api (producción) o https://sandbox.flow.cl/api (pruebas).`}
            </span>
          </span>
          {flow.data && (
            <Badge variant={flow.data.configured ? "default" : "destructive"}>
              {flow.data.configured ? "OK" : "Falta configurar"}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
