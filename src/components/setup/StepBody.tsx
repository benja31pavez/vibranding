import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWhatsAppCard } from "@/components/chatbot/ConnectWhatsAppCard";
import { GoogleAdsConnectCard } from "@/components/google-ads/GoogleAdsConnectCard";
import { GoogleAdsBillingPanel } from "@/components/google-ads/GoogleAdsBillingPanel";
import { syncGoogleAdsNow } from "@/lib/google-ads/connection.functions";
import { useInvalidateClientCapabilities } from "@/hooks/use-client-capabilities";
import { ErrorState, ListSkeleton } from "@/components/app";
import { Facts, HowTo } from "./setupShared";
import { fmtDate } from "./setupConstants";
import { MetaAssetPicker } from "./MetaAssetPicker";
import { IngestStep, InstagramSyncStep, MetaBillingStep, MetaLoginStep } from "./MetaSteps";
import type { StepKey } from "./connectionModel";
import type { ConnectionsState } from "./useConnections";

interface StepProps {
  clientId: string;
  state: ConnectionsState;
}

function AdAccountStep({ clientId, state }: StepProps) {
  const account = state.status.data?.account ?? null;
  return (
    <div className="space-y-4">
      {state.caps.has_ad_account && account && (
        <Facts
          lines={[
            `${account.ad_account_id} · moneda ${account.currency ?? "desconocida"} · zona horaria ${account.timezone_name ?? "desconocida"}`,
          ]}
        />
      )}
      <MetaAssetPicker clientId={clientId} kind="ad_account" onSaved={state.refreshMeta} />
      <p className="text-sm text-muted-foreground">
        Campañas, conjuntos e IDs a mano en{" "}
        <Link
          to="/clients/$clientId/meta-ads"
          params={{ clientId }}
          className="text-primary hover:underline"
        >
          Meta Ads
        </Link>
        .
      </p>
    </div>
  );
}

function InstagramLinkStep({ clientId, state }: StepProps) {
  const account = state.status.data?.account ?? null;
  const ig = state.status.data?.instagram ?? null;
  return (
    <div className="space-y-4">
      {state.caps.has_instagram && (
        <Facts
          lines={[
            `${ig?.username ? `@${ig.username}` : `ID ${account?.ig_account_id}`} · ${
              ig?.followers != null
                ? `${ig.followers.toLocaleString("es-CL")} seguidores`
                : "seguidores sin sincronizar"
            }`,
          ]}
        />
      )}
      <p className="text-sm text-muted-foreground">
        Elige la cuenta profesional de Instagram vinculada a la página del cliente.
      </p>
      <MetaAssetPicker clientId={clientId} kind="instagram" onSaved={state.refreshMeta} />
    </div>
  );
}

function WhatsAppStep({ clientId, state }: StepProps) {
  const invalidateCaps = useInvalidateClientCapabilities();
  const { whatsapp } = state;
  if (whatsapp.isLoading) return <ListSkeleton rows={2} label="Cargando WhatsApp" />;
  if (whatsapp.error) {
    return (
      <ErrorState
        title="No pudimos cargar la conexión de WhatsApp"
        message={(whatsapp.error as Error).message}
        onRetry={() => void whatsapp.refetch()}
        retrying={whatsapp.isFetching}
      />
    );
  }
  return (
    <div className="space-y-4">
      <ConnectWhatsAppCard
        clientId={clientId}
        account={whatsapp.data ?? null}
        onChange={() => {
          void whatsapp.refetch();
          // El candado de WhatsApp del menú depende de esta conexión.
          void invalidateCaps(clientId);
        }}
      />
      {state.caps.has_whatsapp && (
        <p className="text-sm text-muted-foreground">
          Conversaciones, IA y reglas del bot en{" "}
          <Link
            to="/clients/$clientId/bandeja"
            params={{ clientId }}
            className="text-primary hover:underline"
          >
            WhatsApp
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function OutcomesStep({ clientId, state }: StepProps) {
  const done = state.caps.has_outcomes;
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      {done ? (
        <Facts lines={["Ya hay conversaciones marcadas: Analítica puede calcular el embudo"]} />
      ) : (
        <p>Marca cada conversación como respondida, calificada, cerrada o perdida.</p>
      )}
      <Button asChild size="sm" variant={done ? "secondary" : "default"}>
        <Link to="/clients/$clientId/backfill" params={{ clientId }}>
          {done ? "Seguir marcando" : "Ir a marcar conversaciones"}
        </Link>
      </Button>
    </div>
  );
}

function GoogleSyncStep({ clientId, state }: StepProps) {
  const sync = useServerFn(syncGoogleAdsNow);
  const conn = state.google.data?.connection ?? null;
  const syncMut = useMutation({
    mutationFn: () => sync({ data: { clientId } }),
    onSuccess: (res) => toast.success(`Métricas actualizadas · ${res.rows} filas`),
    onError: (e: Error) => toast.error(e.message || "No se pudo actualizar"),
    onSettled: () => {
      void state.google.refetch();
      void state.googleBilling.refetch();
    },
  });
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      {conn?.lastSyncedAt && <Facts lines={[`Última descarga: ${fmtDate(conn.lastSyncedAt)}`]} />}
      <p>Descarga las métricas de las campañas. Después se actualiza sola cada madrugada.</p>
      <Button
        size="sm"
        variant={conn?.lastSyncedAt ? "secondary" : "default"}
        onClick={() => syncMut.mutate()}
        disabled={syncMut.isPending}
      >
        {syncMut.isPending ? (
          <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw aria-hidden className="mr-1.5 h-4 w-4" />
        )}
        {syncMut.isPending ? "Actualizando…" : "Actualizar ahora"}
      </Button>
      {conn?.lastSyncError && (
        <p className="text-danger-strong" role="alert">
          {conn.lastSyncError}
        </p>
      )}
      <HowTo>
        <p>
          La plataforma solo lee métricas y el estado de pago de la cuenta: nunca crea ni cambia
          campañas en Google Ads.
        </p>
      </HowTo>
    </div>
  );
}

/** Contenido de cada paso: reutiliza las tarjetas y acciones de cada sección. */
export function StepBody({ step, clientId, state }: StepProps & { step: StepKey }) {
  switch (step) {
    case "meta-login":
      return <MetaLoginStep clientId={clientId} state={state} />;
    case "ig-link":
      return <InstagramLinkStep clientId={clientId} state={state} />;
    case "ig-sync":
      return <InstagramSyncStep clientId={clientId} state={state} />;
    case "ad-account":
      return <AdAccountStep clientId={clientId} state={state} />;
    case "ingest":
      return <IngestStep state={state} />;
    case "meta-billing":
      return <MetaBillingStep state={state} />;
    case "wa-start":
    case "wa-number":
      return <WhatsAppStep clientId={clientId} state={state} />;
    case "wa-outcomes":
      return <OutcomesStep clientId={clientId} state={state} />;
    case "gads-link":
      return <GoogleAdsConnectCard clientId={clientId} />;
    case "gads-sync":
      return <GoogleSyncStep clientId={clientId} state={state} />;
    case "gads-billing":
      return <GoogleAdsBillingPanel clientId={clientId} />;
  }
}
