import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  MoreHorizontal,
  Plug,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog, ErrorState, ListSkeleton, Panel } from "@/components/app";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { formatCustomerId } from "@/lib/google-ads/gaql";
import { googleOAuthErrorMessage } from "@/lib/google-ads/oauthErrors";
import {
  disconnectGoogleAds,
  linkGoogleAdsCustomer,
  startGoogleAdsOAuth,
  syncGoogleAdsNow,
  type CustomerSource,
  type GoogleAdsOverview,
} from "@/lib/google-ads/connection.functions";
import { GoogleAdsAccountPicker } from "@/components/google-ads/GoogleAdsAccountPicker";
import { googleAdsBillingKey } from "@/components/google-ads/googleAdsBillingQueries";
import {
  googleAdsOverviewKey,
  useGoogleAdsOverview,
} from "@/components/google-ads/googleAdsOverviewQueries";

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" });

/** Avisos que deja el callback de OAuth en la URL (?gads=…). */
function useOAuthReturnToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gads");
    // Solo códigos cortos en la URL; el texto se arma aquí.
    const code = params.get("gads_error");
    if (status === "conectado" && code) toast.warning(googleOAuthErrorMessage(code));
    if (status === "conectado" && !code) toast.success("Google Ads conectado");
    if (status === "elegir")
      toast.info("Conectado. Elige cuál cuenta de Google Ads es de este cliente.");
    if (status === "cancelado") toast.info("Conexión con Google cancelada");
    if (status === "error") toast.error(googleOAuthErrorMessage(code));
  }, []);
}

function NotConfigured({ missing }: { missing: GoogleAdsOverview["missing"] }) {
  return (
    <Panel
      title="Google Ads aún no está habilitado"
      icon={AlertTriangle}
      tone="warning"
      info="Mientras tanto no se descarga nada y el reporte mensual muestra solo los datos que ya existan."
    >
      <p className="text-sm">
        Faltan credenciales de la app de la agencia (las agrega quien administra el servidor):
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {missing.map((m) => (
          <li key={m.name}>
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{m.name}</code>
            <span className="ml-2 text-muted-foreground">{m.why}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function GoogleAdsConnectCard({ clientId }: { clientId: string }) {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Origen del selector abierto: cuentas de la MCC de la agencia o del token propio.
  const [picking, setPicking] = useState<CustomerSource | null>(null);
  const startOAuth = useServerFn(startGoogleAdsOAuth);
  const link = useServerFn(linkGoogleAdsCustomer);
  const sync = useServerFn(syncGoogleAdsNow);
  const disconnect = useServerFn(disconnectGoogleAds);
  useOAuthReturnToast();

  const overviewKey = googleAdsOverviewKey(userKey, clientId);
  const overview = useGoogleAdsOverview(clientId);

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: overviewKey });
    void queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns", userKey, clientId] });
    void queryClient.invalidateQueries({ queryKey: ["google-ads-customers", userKey, clientId] });
    void queryClient.invalidateQueries({ queryKey: googleAdsBillingKey(userKey, clientId) });
  };

  const connectMut = useMutation({
    mutationFn: () => startOAuth({ data: { clientId } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo iniciar la conexión"),
  });
  const linkMut = useMutation({
    mutationFn: (v: { customerId: string; source: CustomerSource }) =>
      link({ data: { clientId, customerId: v.customerId, source: v.source } }),
    onSuccess: (res) => {
      setPicking(null);
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
    const agency = overview.data.agency;
    if (agency) {
      return (
        <Panel
          icon={Plug}
          title="Elige la cuenta del cliente"
          description={`Cuentas bajo la MCC de la agencia (${formatCustomerId(agency.managerCustomerId)}).`}
          info="El cliente paga su pauta con su propia tarjeta en su cuenta. La plataforma solo lee métricas y el estado de pago: nunca crea ni cambia campañas."
        >
          <GoogleAdsAccountPicker
            clientId={clientId}
            currentCustomerId={null}
            busy={busy}
            source="agencia"
            onPick={(customerId) => linkMut.mutate({ customerId, source: "agencia" })}
          />
        </Panel>
      );
    }
    // Un solo llamado a la acción: conectar la MCC de la agencia (una vez para todos).
    return (
      <Panel
        icon={Plug}
        title="Conecta Google Ads"
        description="Conecta la MCC de la agencia una sola vez y luego elige aquí la cuenta del cliente."
        info="La plataforma solo lee métricas y el estado de pago: nunca crea ni cambia campañas."
        actions={
          <Button asChild size="sm">
            <Link to="/settings/google-ads">
              <Plug aria-hidden className="mr-1.5 h-4 w-4" /> Conectar MCC de la agencia
            </Link>
          </Button>
        }
      >
        <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          ¿El cliente tiene su propia cuenta de Google?
          <Button size="sm" variant="ghost" onClick={() => connectMut.mutate()} disabled={busy}>
            Conectar cuenta propia
          </Button>
        </p>
      </Panel>
    );
  }

  const viaAgency = connection.authSource === "agencia";
  const pickSource: CustomerSource | null =
    connection.status === "pendiente" ? connection.authSource : picking;
  const broken = connection.status === "error" || !connection.hasToken;

  return (
    <>
      <Panel
        title="Google Ads"
        tone={broken ? "warning" : "default"}
        description={
          connection.status === "conectada"
            ? `Cuenta ${formatCustomerId(connection.customerId)}${
                viaAgency
                  ? " (vía MCC de la agencia)"
                  : connection.managerCustomerId
                    ? ` (vía MCC ${formatCustomerId(connection.managerCustomerId)})`
                    : ""
              }`
            : "Falta elegir la cuenta de este cliente"
        }
        actions={
          <>
            {broken &&
              (viaAgency ? (
                <Button asChild size="sm">
                  <Link to="/settings/google-ads">Revisar MCC de la agencia</Link>
                </Button>
              ) : (
                connectButton("Reconectar")
              ))}
            {connection.status === "conectada" && !broken && !picking && (
              <Button size="sm" variant="outline" onClick={() => syncMut.mutate()} disabled={busy}>
                <RefreshCw
                  aria-hidden
                  className={`mr-1.5 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`}
                />
                Actualizar ahora
              </Button>
            )}
            {picking ? (
              <Button size="sm" variant="ghost" onClick={() => setPicking(null)} disabled={busy}>
                Cancelar
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Más opciones de Google Ads">
                    <MoreHorizontal aria-hidden className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {connection.status === "conectada" && !broken && (
                    <DropdownMenuItem onSelect={() => setPicking(connection.authSource)}>
                      <ArrowLeftRight aria-hidden className="mr-2 h-4 w-4" /> Cambiar cuenta
                    </DropdownMenuItem>
                  )}
                  {!viaAgency && overview.data.agency && (
                    <DropdownMenuItem onSelect={() => setPicking("agencia")}>
                      <Building2 aria-hidden className="mr-2 h-4 w-4" /> Pasar a la MCC de la
                      agencia
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-danger-strong focus:text-danger-strong"
                    onSelect={() => setConfirmOpen(true)}
                  >
                    <Unplug aria-hidden className="mr-2 h-4 w-4" /> Desconectar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
          {pickSource && !(broken && pickSource === connection.authSource) && (
            <GoogleAdsAccountPicker
              clientId={clientId}
              currentCustomerId={connection.customerId}
              busy={busy}
              source={pickSource}
              onPick={(customerId) => linkMut.mutate({ customerId, source: pickSource })}
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
