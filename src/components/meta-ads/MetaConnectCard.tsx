import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertTriangle,
  KeyRound,
  MoreHorizontal,
  Plug,
  RefreshCw,
  Stethoscope,
  Unplug,
} from "lucide-react";
import {
  ConfirmDialog,
  ErrorState,
  InfoHint,
  ListSkeleton,
  Panel,
  StatusBadge,
} from "@/components/app";
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
import { metaOAuthErrorMessage } from "@/lib/meta/oauthErrors";

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" });

export function MetaConnectCard({ clientId }: { clientId: string }) {
  const [conn, setConn] = useState<MetaConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [sysOpen, setSysOpen] = useState(false);
  const [dupe, setDupe] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const fetchConn = useServerFn(getMetaConnection);
  const startOAuth = useServerFn(startMetaOAuth);
  const disconnect = useServerFn(disconnectMeta);
  const syncNow = useServerFn(syncMetaInsights);
  const checkConflict = useServerFn(checkAdAccountConflict);
  const invalidateCaps = useInvalidateClientCapabilities();

  const load = async () => {
    let next: MetaConnection | null;
    try {
      next = (await fetchConn({ data: { clientId } })) as MetaConnection | null;
    } catch (e: any) {
      // Sin leer la conexión no sabemos si está conectada: mostrar error, no «Conecta Meta».
      setLoadError(e?.message ?? "No se pudo leer la conexión");
      setLoaded(true);
      return;
    }
    setLoadError(null);
    setConn(next);
    setLoaded(true);
    // Conectar/desconectar cambia los candados del sidebar y la configuración guiada.
    void invalidateCaps(clientId);
    try {
      if (next?.ad_account_id) {
        const res = (await checkConflict({
          data: { clientId, adAccountId: next.ad_account_id },
        })) as { conflicts: { clientName: string | null }[] };
        setDupe((res?.conflicts ?? []).map((c) => c.clientName ?? "otro cliente"));
      } else setDupe([]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo revisar si la cuenta está repetida");
    }
  };

  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("meta");
    const code = params.get("meta_error");
    if (status === "conectado") {
      if (code) toast.warning(metaOAuthErrorMessage(code));
      else toast.success("Cuenta de Meta conectada");
    }
    if (status === "cancelado") toast.info("Conexión con Meta cancelada");
    if (status === "error") toast.error(metaOAuthErrorMessage(code));
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

  if (!loaded) return <ListSkeleton rows={2} label="Revisando conexión con Meta" />;
  if (loadError && !conn) {
    return (
      <ErrorState
        title="No pudimos revisar la conexión con Meta"
        message={loadError}
        onRetry={() => void retry()}
        retrying={retrying}
      />
    );
  }

  const tokenButton = (
    <Button size="sm" variant="ghost" onClick={() => setSysOpen(true)}>
      <KeyRound aria-hidden className="mr-1.5 h-4 w-4" />
      Usar token permanente
    </Button>
  );

  return (
    <>
      {conn?.connected ? (
        <Panel
          icon={Plug}
          title={
            <>
              Meta <StatusBadge status="connected" label="Conectada" tone="success" />
            </>
          }
          actions={
            <>
              <Button size="sm" variant="outline" onClick={doSync} disabled={busy}>
                <RefreshCw aria-hidden className={`mr-1.5 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                Sincronizar ayer
              </Button>
              {/* modal={false}: el menú no bloquea el body; los diálogos se abren fuera del menú. */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Más opciones de Meta">
                    <MoreHorizontal aria-hidden className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={busy} onSelect={() => setSysOpen(true)}>
                    <KeyRound aria-hidden className="mr-2 h-4 w-4" /> Cambiar token permanente
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/meta-diagnostics">
                      <Stethoscope aria-hidden className="mr-2 h-4 w-4" /> Diagnóstico
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-danger-strong focus:text-danger-strong"
                    disabled={busy}
                    onSelect={() => setConfirmOpen(true)}
                  >
                    <Unplug aria-hidden className="mr-2 h-4 w-4" /> Desconectar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        >
          <div className="space-y-2 text-sm">
            {dupe.length > 0 && (
              <DuplicateAccountAlert adAccountId={conn.ad_account_id} dupe={dupe} />
            )}
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
              <ConnFact label="Cuenta publicitaria" value={conn.ad_account_id} />
              <ConnFact label="Página" value={conn.page_id} />
              <ConnFact label="Instagram" value={conn.ig_account_id} />
            </dl>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {conn.last_synced_at
                ? `Última descarga: ${DATE_FMT.format(new Date(conn.last_synced_at))}`
                : "Aún sin descargas"}
              <InfoHint>
                Las métricas se descargan solas cada madrugada (entre 2 y 3 a. m., hora de Chile).
              </InfoHint>
            </p>
            {conn.last_sync_error && (
              <p className="text-xs text-danger-strong" role="alert">
                Último error: {conn.last_sync_error}
              </p>
            )}
          </div>
        </Panel>
      ) : (
        <Panel
          icon={Plug}
          title="Conecta Meta"
          info={
            <>
              Meta todavía está revisando nuestra app. Mientras tanto, «Conectar con Meta» solo
              funciona con cuentas que tengan rol de desarrollador o tester en la app. Para el
              resto, usa un token permanente. El token queda cifrado en el servidor.
            </>
          }
          description="Solo lectura de métricas de anuncios, página e Instagram."
          actions={
            <Button size="sm" onClick={connect} disabled={busy}>
              <Plug aria-hidden className="mr-1.5 h-4 w-4" /> Conectar con Meta
            </Button>
          }
        >
          <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
            ¿No funciona la conexión normal? {tokenButton}
          </p>
        </Panel>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Desconectar Meta?"
        description="Las métricas ya descargadas se conservan."
        confirmLabel="Desconectar"
        destructive
        onConfirm={() => void doDisconnect()}
      />
      <MetaSystemUserDialog
        clientId={clientId}
        open={sysOpen}
        onOpenChange={setSysOpen}
        onConnected={load}
      />
    </>
  );
}

function ConnFact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-1.5">
      <dt>{label}:</dt>
      <dd className="font-mono text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function DuplicateAccountAlert({
  adAccountId,
  dupe,
}: {
  adAccountId: string | null | undefined;
  dupe: string[];
}) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-app-md border border-danger/40 bg-danger-subtle p-3 text-xs text-danger-strong"
    >
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        La cuenta publicitaria <span className="font-mono">{adAccountId}</span> también está
        asignada a: <strong>{dupe.join(", ")}</strong>. El gasto se contaría dos veces.
      </p>
    </div>
  );
}
