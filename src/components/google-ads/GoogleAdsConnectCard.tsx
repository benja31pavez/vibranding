import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plug, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ErrorState, ListSkeleton, Panel } from "@/components/app";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { formatCustomerId } from "@/lib/google-ads/gaql";
import {
  disconnectGoogleAds,
  getGoogleAdsOverview,
  linkGoogleAdsCustomer,
  startGoogleAdsOAuth,
  syncGoogleAdsNow,
  type GoogleAdsOverview,
} from "@/lib/google-ads/connection.functions";
import { GoogleAdsAccountPicker } from "@/components/google-ads/GoogleAdsAccountPicker";

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" });

/** Avisos que deja el callback de OAuth en la URL (?gads=…). */
function useOAuthReturnToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gads");
    const detail = params.get("gads_error");
    if (status === "conectado" && detail) toast.warning(detail);
    if (status === "conectado" && !detail) toast.success("Google Ads conectado");
    if (status === "elegir")
      toast.info("Conectado. Elige cuál cuenta de Google Ads es de este cliente.");
    if (status === "cancelado") toast.info("Conexión con Google cancelada");
    if (status === "error") toast.error(detail ?? "No se pudo conectar con Google");
  }, []);
}

function NotConfigured({ missing }: { missing: GoogleAdsOverview["missing"] }) {
  return (
    <Panel title="Google Ads: no configurado" icon={AlertTriangle} tone="warning">
      <p className="text-sm">
        Para conectar cuentas de Google Ads, la plataforma necesita las credenciales de la app de la
        agencia en Google Cloud. Hoy faltan estos datos (los agrega quien administra el servidor, en
        Cloudflare):
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {missing.map((m) => (
          <li key={m.name}>
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{m.name}</code>
            <span className="ml-2 text-muted-foreground">{m.why}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Mientras tanto no se descarga nada y el reporte mensual muestra solo los datos que ya
        existan.
      </p>
    </Panel>
  );
}

export function GoogleAdsConnectCard({ clientId }: { clientId: string }) {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const fetchOverview = useServerFn(getGoogleAdsOverview);
  const startOAuth = useServerFn(startGoogleAdsOAuth);
  const link = useServerFn(linkGoogleAdsCustomer);
  const sync = useServerFn(syncGoogleAdsNow);
  const disconnect = useServerFn(disconnectGoogleAds);
  useOAuthReturnToast();

  const overviewKey = ["google-ads-overview", userKey, clientId] as const;
  const overview = useQuery({
    queryKey: overviewKey,
    queryFn: () => fetchOverview({ data: { clientId } }),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: overviewKey });
    void queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns", userKey, clientId] });
    void queryClient.invalidateQueries({ queryKey: ["google-ads-customers", userKey, clientId] });
  };

  const connectMut = useMutation({
    mutationFn: () => startOAuth({ data: { clientId } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo iniciar la conexión"),
  });
  const linkMut = useMutation({
    mutationFn: (customerId: string) => link({ data: { clientId, customerId } }),
    onSuccess: (res) => {
      setPicking(false);
      if (res.syncError)
        toast.warning(`Cuenta vinculada, pero la descarga falló: ${res.syncError}`);
      else toast.success(`Cuenta vinculada · ${res.rows} filas descargadas`);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo vincular la cuenta"),
  });
  const syncMut = useMutation({
    mutationFn: () => sync({ data: { clientId } }),
    onSuccess: (res) => {
      toast.success(`Métricas actualizadas · ${res.rows} filas`);
      refreshAll();
    },
    onError: (e: Error) => {
      toast.error(e.message || "No se pudo actualizar");
      refreshAll();
    },
  });
  const disconnectMut = useMutation({
    mutationFn: () => disconnect({ data: { clientId } }),
    onSuccess: () => {
      toast.success("Google Ads desconectado");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo desconectar"),
  });

  if (overview.isLoading)
    return <ListSkeleton rows={2} label="Revisando conexión con Google Ads" />;
  if (overview.error || !overview.data) {
    return (
      <ErrorState
        title="No pudimos revisar Google Ads"
        message={(overview.error as Error | null)?.message}
        onRetry={() => void overview.refetch()}
        retrying={overview.isFetching}
      />
    );
  }

  const { configured, missing, connection } = overview.data;
  if (!configured) return <NotConfigured missing={missing} />;

  const busy =
    connectMut.isPending || linkMut.isPending || syncMut.isPending || disconnectMut.isPending;
  const connectButton = (label: string) => (
    <Button size="sm" onClick={() => connectMut.mutate()} disabled={busy}>
      <Plug className="mr-1.5 h-4 w-4" /> {label}
    </Button>
  );

  if (!connection) {
    return (
      <Panel
        title="Google Ads"
        description="Conecta la cuenta de Google con acceso a los anuncios del cliente (solo lectura de campañas)."
        actions={connectButton("Conectar con Google")}
      >
        <p className="text-sm text-muted-foreground">
          Se pedirá iniciar sesión en Google y aceptar el acceso a Google Ads. Después eliges cuál
          cuenta es de este cliente. La plataforma solo lee métricas: nunca crea ni cambia campañas.
        </p>
      </Panel>
    );
  }

  const needsPick = connection.status === "pendiente" || picking;
  const broken = connection.status === "error" || !connection.hasToken;

  return (
    <>
      <Panel
        title="Google Ads"
        tone={broken ? "warning" : "default"}
        description={
          connection.status === "conectada"
            ? `Cuenta ${formatCustomerId(connection.customerId)}${
                connection.managerCustomerId
                  ? ` (vía MCC ${formatCustomerId(connection.managerCustomerId)})`
                  : ""
              }`
            : "Falta elegir la cuenta de este cliente"
        }
        actions={
          <>
            {broken && connectButton("Reconectar")}
            {connection.status === "conectada" && !broken && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncMut.mutate()}
                  disabled={busy}
                >
                  <RefreshCw
                    className={`mr-1.5 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`}
                  />
                  Actualizar ahora
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPicking((p) => !p)}
                  disabled={busy}
                >
                  {picking ? "Cancelar" : "Cambiar cuenta"}
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={busy}>
              Desconectar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {connection.status === "conectada" && !broken && (
            <p className="flex items-center gap-1.5 text-success-strong">
              <CheckCircle2 className="h-4 w-4" /> Conectada.{" "}
              <span className="text-muted-foreground">
                {connection.lastSyncedAt
                  ? `Última descarga: ${DATE_FMT.format(new Date(connection.lastSyncedAt))}.`
                  : "Aún sin descargas."}{" "}
                Se actualiza sola cada madrugada.
              </span>
            </p>
          )}
          {connection.lastSyncError && (
            <p className="text-danger-strong" role="alert">
              {connection.lastSyncError}
            </p>
          )}
          {needsPick && !broken && (
            <GoogleAdsAccountPicker
              clientId={clientId}
              currentCustomerId={connection.customerId}
              busy={busy}
              onPick={(customerId) => linkMut.mutate(customerId)}
            />
          )}
        </div>
      </Panel>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Desconectar Google Ads?"
        description="Se borra el acceso guardado y la cuenta queda libre para otro cliente. Las métricas ya descargadas se conservan en los reportes."
        confirmLabel="Desconectar"
        destructive
        onConfirm={() => disconnectMut.mutate()}
      />
    </>
  );
}
