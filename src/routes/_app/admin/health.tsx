import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { getJobHealth, type JobHealthRow } from "@/lib/admin/health.functions";
import { getIgWebhookStatus } from "@/lib/instagram/webhook.functions";

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

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "medium" });
}

function isStale(job: JobHealthRow): boolean {
  const h = hoursSince(job.last_success);
  return h === null || h > STALE_HOURS;
}

function HealthPage() {
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
  const igBlocked =
    !!igData &&
    (!igData.publicOriginConfigured ||
      !igData.verifyTokenConfigured ||
      igData.publicOriginReachable === false);

  const jobs = data?.jobs ?? [];
  const staleJobs = jobs.filter(isStale);
  const failed24h = jobs.reduce((acc, j) => acc + Number(j.failed_24h ?? 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
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
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>No se pudo leer el estado</AlertTitle>
          <AlertDescription>{(error as Error)?.message}</AlertDescription>
        </Alert>
      )}

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
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && jobs.length === 0 && (
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
          {ig.isLoading && <p className="text-muted-foreground">Cargando…</p>}
          {ig.isError && (
            <p className="text-destructive text-xs">
              {(ig.error as Error)?.message ?? "No se pudo leer el estado de Instagram."}
            </p>
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
          <CardTitle className="text-base">Últimas ejecuciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin registros todavía.</p>
          )}
          {(data?.recent ?? []).map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 text-sm"
            >
              <span className="font-mono text-xs">{r.job_name}</span>
              <span className="text-xs text-muted-foreground">{fmt(r.started_at)}</span>
              <div className="flex items-center gap-2">
                {r.http_status != null && (
                  <span className="text-xs text-muted-foreground">HTTP {r.http_status}</span>
                )}
                <Badge
                  variant={
                    r.status === "succeeded"
                      ? "default"
                      : r.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {r.status}
                </Badge>
              </div>
              {r.error && (
                <p className="w-full text-xs text-destructive break-all">{r.error}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
