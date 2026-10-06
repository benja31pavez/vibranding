import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { ErrorState, ListSkeleton, PageContainer, PageHeader } from "@/components/app";
import { AlertTriangle, CheckCircle2, Copy, XCircle } from "lucide-react";
import {
  debugMetaConnection,
  getMetaDiagnostics,
  testMetaIngest,
  type MetaAccountDiag,
  type MetaEnvStatus,
} from "@/lib/meta/diagnostics.functions";

export const Route = createFileRoute("/_app/admin/meta-diagnostics")({
  component: MetaDiagnosticsPage,
  head: () => ({
    meta: [
      { title: "Diagnóstico de Meta · Vibranding" },
      {
        name: "description",
        content:
          "Verifica la configuración de la integración con Meta: variables presentes, redirect_uri, permisos otorgados y prueba de ingesta.",
      },
      { property: "og:title", content: "Diagnóstico de Meta · Vibranding" },
      {
        property: "og:description",
        content: "Estado de la conexión con Meta: credenciales, permisos e ingesta de métricas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-primary" />
      ) : (
        <XCircle className="w-4 h-4 text-destructive" />
      )}
      <span className="font-mono">{label}</span>
      <span className="text-muted-foreground">{ok ? "configurada" : "falta"}</span>
    </div>
  );
}

/** Para quien no es admin de plataforma: estado general sin nombres de variables. */
function ConfigSummary({ ok }: { ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 aria-hidden className="w-4 h-4 text-primary" />
      ) : (
        <XCircle aria-hidden className="w-4 h-4 text-destructive" />
      )}
      <span>
        {ok
          ? "La configuración del servidor está completa."
          : "Falta parte de la configuración del servidor. Avisa a un administrador de la plataforma."}
      </span>
    </div>
  );
}

function MetaDiagnosticsPage() {
  const [env, setEnv] = useState<MetaEnvStatus | null>(null);
  const [accounts, setAccounts] = useState<MetaAccountDiag[]>([]);
  const [loading, setLoading] = useState(true);
  const [canSeeConfig, setCanSeeConfig] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchDiag = useServerFn(getMetaDiagnostics);
  const runIngest = useServerFn(testMetaIngest);
  const runDebug = useServerFn(debugMetaConnection);

  useEffect(() => {
    (async () => {
      try {
        const res = (await fetchDiag({} as any)) as {
          env: MetaEnvStatus;
          accounts: MetaAccountDiag[];
          canSeeConfig: boolean;
        };
        setEnv(res.env);
        setAccounts(res.accounts);
        setCanSeeConfig(res.canSeeConfig);
      } catch (e: any) {
        setLoadError(e?.message ?? "No se pudo cargar el diagnóstico");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const test = async (accountId: string) => {
    setBusy(accountId);
    setResult(null);
    try {
      setResult(await runIngest({ data: { accountId, date } }));
    } catch (e: any) {
      setResult({ error: e?.message ?? "Error inesperado" });
    } finally {
      setBusy(null);
    }
  };

  // Raw probe: no friendly messages, every Meta payload as returned.
  const fullTest = async (accountId: string) => {
    setBusy(`${accountId}:debug`);
    setResult(null);
    try {
      setResult(await runDebug({ data: { accountId, date } }));
    } catch (e: any) {
      setResult({ error: e?.message ?? "Error inesperado" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Diagnóstico de Meta"
        description="Credenciales, permisos y prueba de ingesta de la integración con Meta."
        breadcrumb={
          canSeeConfig
            ? [{ label: "Salud", to: "/admin/health" }, { label: "Diagnóstico de Meta" }]
            : undefined
        }
      />

      {loading && <ListSkeleton rows={4} label="Cargando diagnóstico" />}
      {loadError && <ErrorState message={loadError} onRetry={() => window.location.reload()} />}

      {env && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuración del servidor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canSeeConfig ? (
                <>
                  <Flag ok={env.META_APP_ID} label="META_APP_ID" />
                  <Flag ok={env.META_APP_SECRET} label="META_APP_SECRET" />
                  <Flag ok={env.PUBLIC_SITE_URL} label="PUBLIC_SITE_URL" />
                  <Flag ok={env.DISPATCH_SECRET} label="DISPATCH_SECRET" />
                </>
              ) : (
                <ConfigSummary
                  ok={
                    env.META_APP_ID &&
                    env.META_APP_SECRET &&
                    env.PUBLIC_SITE_URL &&
                    env.DISPATCH_SECRET
                  }
                />
              )}
              <p className="text-xs text-muted-foreground pt-2">
                Versión de Graph API en uso:{" "}
                <span className="font-mono">{env.META_GRAPH_VERSION}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">redirect_uri para registrar en Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {env.redirectUri ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted rounded-md px-3 py-2 text-xs break-all select-all">
                    {env.redirectUri}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copy(env.redirectUri!)}>
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Origen público sin configurar</AlertTitle>
                  <AlertDescription>{env.redirectUriError}</AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Pégala tal cual en “Valid OAuth Redirect URIs” del panel de la app de Meta.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cuentas conectadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {accounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay cuentas de Meta conectadas todavía.
                </p>
              )}
              {accounts.map((a) => (
                <div key={a.accountId} className="border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium text-sm">
                      {a.clientName ?? a.clientId}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {a.adAccountId ?? "sin cuenta publicitaria"}
                      </span>
                    </div>
                    {a.tokenValid === true ? (
                      <Badge className="gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Token válido
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="w-3 h-3" /> Token inválido
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      Permisos otorgados:{" "}
                      <span className="font-mono">
                        {a.grantedScopes.length ? a.grantedScopes.join(", ") : "—"}
                      </span>
                    </div>
                    <div>
                      Permisos solicitados:{" "}
                      <span className="font-mono">{a.requestedScopes.join(", ")}</span>
                    </div>
                    {a.missingScopes.length > 0 && (
                      <div className="text-destructive">
                        Faltan: <span className="font-mono">{a.missingScopes.join(", ")}</span>
                      </div>
                    )}
                    <div>
                      Expira:{" "}
                      {a.tokenExpiresAt
                        ? new Date(a.tokenExpiresAt).toLocaleString("es-CL")
                        : "sin fecha (token de larga duración)"}
                    </div>
                    <div>
                      Última descarga:{" "}
                      {a.lastSyncedAt
                        ? new Date(a.lastSyncedAt).toLocaleString("es-CL")
                        : "pendiente"}
                    </div>
                    {a.tokenError && <div className="text-destructive">Token: {a.tokenError}</div>}
                    {a.lastSyncError && (
                      <div className="text-destructive">
                        Última sincronización: {a.lastSyncError}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-40 h-8"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === a.accountId}
                      onClick={() => test(a.accountId)}
                    >
                      {busy === a.accountId ? "Probando…" : "Probar ingesta"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy === `${a.accountId}:debug`}
                      onClick={() => fullTest(a.accountId)}
                    >
                      {busy === `${a.accountId}:debug`
                        ? "Consultando Meta…"
                        : "Probar conexión completa"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    “Probar conexión completa” devuelve la respuesta cruda de Meta: report_run_id,
                    cada async_status y el objeto de error completo.
                  </p>
                </div>
              ))}
              {result !== null && (
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
