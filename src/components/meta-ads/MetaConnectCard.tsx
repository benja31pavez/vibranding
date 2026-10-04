import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Plug, RefreshCw, AlertTriangle, KeyRound } from "lucide-react";
import { MetaSystemUserDialog } from "@/components/meta-ads/MetaSystemUserDialog";
import {
  getMetaConnection,
  startMetaOAuth,
  disconnectMeta,
  syncMetaInsights,
  checkAdAccountConflict,
  type MetaConnection,
} from "@/lib/meta/connection.functions";
import { useInvalidateClientCapabilities } from "@/hooks/use-client-capabilities";

export function MetaConnectCard({ clientId }: { clientId: string }) {
  const [conn, setConn] = useState<MetaConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [sysOpen, setSysOpen] = useState(false);
  const [dupe, setDupe] = useState<string[]>([]);
  const fetchConn = useServerFn(getMetaConnection);
  const startOAuth = useServerFn(startMetaOAuth);
  const disconnect = useServerFn(disconnectMeta);
  const syncNow = useServerFn(syncMetaInsights);
  const checkConflict = useServerFn(checkAdAccountConflict);
  const invalidateCaps = useInvalidateClientCapabilities();

  const load = async () => {
    try {
      const next = (await fetchConn({ data: { clientId } })) as MetaConnection | null;
      setConn(next);
      // Conectar/desconectar cambia los candados del sidebar y la configuración guiada.
      void invalidateCaps(clientId);
      if (next?.ad_account_id) {
        const res = (await checkConflict({
          data: { clientId, adAccountId: next.ad_account_id },
        })) as { conflicts: { clientName: string | null }[] };
        setDupe((res?.conflicts ?? []).map((c) => c.clientName ?? "otro cliente"));
      } else setDupe([]);
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
          <Button size="sm" variant="outline" onClick={() => setSysOpen(true)}>
            <KeyRound className="w-3 h-3 mr-1" />
            Conectar con token permanente
          </Button>

          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/meta-diagnostics">Diagnóstico</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        {dupe.length > 0 && (
          <div role="alert" className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              La cuenta publicitaria <span className="font-mono">{conn?.ad_account_id}</span> también
              está asignada a: <strong>{dupe.join(", ")}</strong>. El gasto se contaría dos veces.
            </p>
          </div>
        )}
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Meta todavía está revisando nuestra app. Mientras tanto, «Conectar con Meta» solo
            funciona con cuentas que tengan rol de <strong>desarrollador</strong> o{" "}
            <strong>tester</strong> en la app. Para el resto, usa la conexión con token permanente.
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
              {" · "}Las métricas se descargan solas cada madrugada (entre 2 y 3 a. m., hora de Chile).
            </div>
            {conn.last_sync_error && (
              <div className="text-destructive">Último error: {conn.last_sync_error}</div>
            )}
          </>
        ) : (
          <p>
            Autoriza el acceso de lectura a métricas de anuncios, páginas e Instagram. El token
            queda cifrado en el servidor y nunca se expone al navegador. Si la conexión normal no
            funciona todavía, usa un token permanente.
          </p>
        )}
      </CardContent>
      <MetaSystemUserDialog
        clientId={clientId}
        open={sysOpen}
        onOpenChange={setSysOpen}
        onConnected={load}
      />
    </Card>
  );
}
