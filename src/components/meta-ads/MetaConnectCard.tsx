import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Plug, RefreshCw, AlertTriangle } from "lucide-react";
import {
  getMetaConnection,
  startMetaOAuth,
  disconnectMeta,
  syncMetaInsights,
  type MetaConnection,
} from "@/lib/meta/connection.functions";

export function MetaConnectCard({ clientId }: { clientId: string }) {
  const [conn, setConn] = useState<MetaConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const fetchConn = useServerFn(getMetaConnection);
  const startOAuth = useServerFn(startMetaOAuth);
  const disconnect = useServerFn(disconnectMeta);
  const syncNow = useServerFn(syncMetaInsights);

  const load = async () => {
    try {
      setConn((await fetchConn({ data: { clientId } })) as MetaConnection | null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer la conexión");
    }
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("meta");
    const detail = params.get("meta_error");
    if (status === "conectado")
      detail ? toast.warning(detail) : toast.success("Cuenta de Meta conectada");
    if (status === "cancelado") toast.info("Conexión con Meta cancelada");
    if (status === "error") toast.error(detail ?? "No se pudo conectar con Meta");
  }, [clientId]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = (await startOAuth({ data: { clientId } })) as { url: string };
      window.location.href = url;
    } catch (e: any) {
      setBusy(false);
      toast.error(e?.message ?? "No se pudo iniciar la conexión");
    }
  };

  const doDisconnect = async () => {
    if (!conn) return;
    if (!confirm("¿Desconectar la cuenta de Meta? Las métricas ya descargadas se conservan.")) return;
    try {
      await disconnect({ data: { accountId: conn.id } });
      toast.success("Cuenta desconectada");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo desconectar");
    }
  };

  const doSync = async () => {
    if (!conn) return;
    setBusy(true);
    try {
      const res = (await syncNow({ data: { accountId: conn.id } })) as any;
      if (res?.error) toast.error(res.error);
      else
        toast.success(
          `Métricas actualizadas (${res.adRows} anuncios, ${res.postRows} publicaciones)`,
        );
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo sincronizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="w-4 h-4" /> Conexión con Meta
          {conn?.connected ? (
            <Badge className="gap-1">
              <CheckCircle2 className="w-3 h-3" /> Conectada
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="w-3 h-3" /> Sin conectar
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-2">
          {conn?.connected && (
            <>
              <Button size="sm" variant="outline" onClick={doSync} disabled={busy}>
                <RefreshCw className={`w-3 h-3 mr-1 ${busy ? "animate-spin" : ""}`} />
                Sincronizar ayer
              </Button>
              <Button size="sm" variant="ghost" onClick={doDisconnect}>
                Desconectar
              </Button>
            </>
          )}
          {!conn?.connected && (
            <Button size="sm" onClick={connect} disabled={busy}>
              Conectar con Meta
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/meta-diagnostics">Diagnóstico</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Los permisos <span className="font-mono">ads_read</span>,{" "}
            <span className="font-mono">pages_read_engagement</span> e{" "}
            <span className="font-mono">instagram_manage_insights</span> requieren App Review y
            verificación del negocio en Meta. Mientras la revisión no esté aprobada, solo pueden
            conectarse las cuentas con rol de <strong>desarrollador</strong> o{" "}
            <strong>tester</strong> en la app de Meta.
          </p>
        </div>
        {conn?.connected ? (
          <>
            <div>
              Cuenta publicitaria: <span className="font-mono">{conn.ad_account_id ?? "—"}</span> ·
              Página: <span className="font-mono">{conn.page_id ?? "—"}</span> · Instagram:{" "}
              <span className="font-mono">{conn.ig_account_id ?? "—"}</span>
            </div>
            <div>
              Última descarga:{" "}
              {conn.last_synced_at
                ? new Date(conn.last_synced_at).toLocaleString("es-CL")
                : "pendiente"}
              {" · "}Las métricas se descargan solas cada día a las 06:20 UTC.
            </div>
            {conn.last_sync_error && (
              <div className="text-destructive">Último error: {conn.last_sync_error}</div>
            )}
          </>
        ) : (
          <p>
            Autoriza el acceso de lectura a métricas de anuncios, páginas e Instagram. El token
            queda cifrado en el servidor y nunca se expone al navegador.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
