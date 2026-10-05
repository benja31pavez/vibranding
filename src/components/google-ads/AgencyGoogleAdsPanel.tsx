import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Building2, CheckCircle2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, ErrorState, ListSkeleton, Panel } from "@/components/app";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { formatCustomerId } from "@/lib/google-ads/gaql";
import { googleOAuthErrorMessage } from "@/lib/google-ads/oauthErrors";
import {
  disconnectAgencyGoogleAds,
  getAgencyGoogleAdsStatus,
  listAgencyManagers,
  setAgencyManager,
  startAgencyGoogleAdsOAuth,
} from "@/lib/google-ads/agency.functions";

const DATE_FMT = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" });

/** Avisos que deja el callback de OAuth de la agencia (?gads=…). */
function useAgencyReturnToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gads");
    const code = params.get("gads_error");
    if (status === "conectado") toast.success("Cuenta administradora (MCC) conectada");
    if (status === "elegir") toast.info("Conectado. Elige cuál MCC es la de la agencia.");
    if (status === "cancelado") toast.info("Conexión con Google cancelada");
    if (status === "error") toast.error(googleOAuthErrorMessage(code));
  }, []);
}

function ManagerPicker({ busy, onPick }: { busy: boolean; onPick: (id: string) => void }) {
  const userKey = useUserKey();
  const list = useServerFn(listAgencyManagers);
  const query = useQuery({
    queryKey: ["google-ads-agency-managers", userKey],
    queryFn: () => list(),
    staleTime: 60_000,
  });
  if (query.isLoading) return <ListSkeleton rows={2} label="Buscando cuentas MCC" />;
  if (query.error) {
    return (
      <ErrorState
        title="No pudimos listar las MCC"
        message={(query.error as Error).message}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  const managers = query.data?.managers ?? [];
  if (managers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta cuenta de Google no administra ninguna MCC. Desconecta y entra con el Google correcto.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border-subtle rounded-app-md border border-border-subtle">
      {managers.map((m) => (
        <li key={m.customerId} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{m.name ?? "Sin nombre"}</div>
            <div className="text-xs tabular-nums text-muted-foreground">
              {formatCustomerId(m.customerId)}
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onPick(m.customerId)}>
            Usar esta MCC
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Configuración → Google Ads: conexión única con la MCC de la agencia. */
export function AgencyGoogleAdsPanel() {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fetchStatus = useServerFn(getAgencyGoogleAdsStatus);
  const startOAuth = useServerFn(startAgencyGoogleAdsOAuth);
  const pickManager = useServerFn(setAgencyManager);
  const disconnect = useServerFn(disconnectAgencyGoogleAds);
  useAgencyReturnToast();

  const statusKey = ["google-ads-agency", userKey] as const;
  const status = useQuery({ queryKey: statusKey, queryFn: () => fetchStatus() });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: statusKey });

  const connectMut = useMutation({
    mutationFn: () => startOAuth(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo iniciar la conexión"),
  });
  const pickMut = useMutation({
    mutationFn: (customerId: string) => pickManager({ data: { customerId } }),
    onSuccess: () => {
      toast.success("MCC de la agencia guardada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar la MCC"),
  });
  const disconnectMut = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("MCC desconectada");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo desconectar"),
  });

  if (status.isLoading)
    return <ListSkeleton rows={3} label="Revisando la conexión de la agencia" />;
  if (status.error || !status.data) {
    return (
      <ErrorState
        title="No pudimos revisar la conexión de Google Ads"
        message={(status.error as Error | null)?.message}
        onRetry={() => void status.refetch()}
        retrying={status.isFetching}
      />
    );
  }

  const { configured, missing, canManage, connection, linkedViaAgency, linkedWithOwnToken } =
    status.data;
  const busy = connectMut.isPending || pickMut.isPending || disconnectMut.isPending;

  if (!configured) {
    return (
      <Panel title="Google Ads: no configurado" icon={AlertTriangle} tone="warning">
        <p className="text-sm">Faltan estas variables del servidor (Cloudflare):</p>
        <ul className="mt-2 space-y-1 text-sm">
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

  const connectButton = (label: string) =>
    canManage ? (
      <Button size="sm" onClick={() => connectMut.mutate()} disabled={busy}>
        <Plug className="mr-1.5 h-4 w-4" aria-hidden /> {label}
      </Button>
    ) : null;

  const broken = connection?.status === "error" || (connection && !connection.hasToken);

  return (
    <div className="space-y-4">
      <Panel
        icon={Building2}
        title="Conectar cuenta administradora (MCC)"
        tone={broken ? "warning" : "default"}
        description={
          connection?.status === "conectada" && connection.managerCustomerId
            ? `${connection.managerName ?? "MCC"} · ${formatCustomerId(connection.managerCustomerId)}`
            : "Inicia sesión con el Google que administra la MCC de Vibranding."
        }
        actions={
          !connection
            ? connectButton("Conectar MCC")
            : canManage && (
                <>
                  {connectButton(broken ? "Reconectar" : "Volver a conectar")}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmOpen(true)}
                    disabled={busy}
                  >
                    Desconectar
                  </Button>
                </>
              )
        }
      >
        <div className="space-y-3 text-sm">
          {!canManage && (
            <p className="text-muted-foreground">
              Solo el dueño o un administrador puede conectar o cambiar la MCC.
            </p>
          )}
          {connection?.status === "conectada" && !broken && (
            <p className="flex items-center gap-1.5 text-success-strong">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Conectada.{" "}
              <span className="text-muted-foreground">
                Actualizada el {DATE_FMT.format(new Date(connection.updatedAt))}.
              </span>
            </p>
          )}
          {connection?.lastError && (
            <p className="text-danger-strong" role="alert">
              {connection.lastError}
            </p>
          )}
          {connection?.status === "pendiente" && connection.hasToken && canManage && (
            <>
              <p>La cuenta de Google administra varias MCC. Elige la de la agencia:</p>
              <ManagerPicker busy={busy} onPick={(id) => pickMut.mutate(id)} />
            </>
          )}
          <p className="text-muted-foreground">
            Clientes vinculados vía MCC: {linkedViaAgency} · con conexión propia (anterior):{" "}
            {linkedWithOwnToken}. Las conexiones propias siguen funcionando; desde la sección Google
            Ads de cada cliente puedes pasarlas a la MCC.
          </p>
        </div>
      </Panel>

      <Panel title="Cómo funciona">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            Cada cliente tiene su propia cuenta de Google Ads, vinculada a la MCC de la agencia, y
            paga la pauta con <strong>su tarjeta</strong> (Facturación de su cuenta).
          </li>
          <li>
            En la sección Google Ads de cada cliente eliges su cuenta desde la lista de la MCC. La
            plataforma solo lee métricas y el estado de pago: nunca crea ni cambia campañas.
          </li>
          <li>
            Cada mañana se revisa el medio de pago de cada cuenta. Si no está verificado, aparece
            una alerta en Inicio con un mensaje listo para pedirle al cliente que actualice su
            tarjeta.
          </li>
        </ul>
      </Panel>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Desconectar la MCC de la agencia?"
        description={`Se borra el acceso guardado. Los ${linkedViaAgency} clientes vinculados vía MCC dejarán de actualizarse hasta reconectar. Las métricas ya descargadas se conservan.`}
        confirmLabel="Desconectar"
        destructive
        onConfirm={() => disconnectMut.mutate()}
      />
    </div>
  );
}
