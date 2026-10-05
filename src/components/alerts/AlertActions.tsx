import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { Check, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";
import { resolveCampaignAlert } from "@/lib/alerts/campaignAlerts.functions";
import { healthKeys } from "@/components/clients/health/healthKeys";
import { BILLING_ALERT_KIND } from "@/lib/google-ads/billing";
import { CardUpdateDialog } from "@/components/google-ads/CardUpdateDialog";

const ADS_MANAGER_PREFIX = "https://adsmanager.facebook.com/adsmanager/";

/** Link al Administrador de anuncios guardado por el motor; solo se acepta el dominio de Meta. */
function adsManagerLink(data: Json | undefined): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const url = (data as Record<string, Json | undefined>).ads_manager_url;
  return typeof url === "string" && url.startsWith(ADS_MANAGER_PREFIX) ? url : null;
}

/** Queries que muestran alertas abiertas: "Hoy", la salud de la ficha y la salud del cliente. */
function showsAlerts(query: Query): boolean {
  const key = query.queryKey;
  return (
    key[0] === healthKeys.all[0] ||
    (key[0] === "dashboard-hoy" && key.includes("campaign-alerts")) ||
    (key[0] === "ficha" && key[3] === "health")
  );
}

function verdictOf(data: Json | undefined): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const v = (data as Record<string, Json | undefined>).verdict;
  return typeof v === "string" ? v : null;
}

interface AlertActionsProps {
  alert: { id: string; client_id: string; data?: Json; kind?: string; platform?: string };
  /** Editores del cliente; los demás solo ven los links. */
  canResolve?: boolean;
}

/**
 * "Marcar como resuelta" + link a las campañas del cliente. Para "Pago de pauta"
 * (billing_google) agrega el mensaje listo para pedirle al cliente que actualice su tarjeta.
 */
export function AlertActions({ alert, canResolve = true }: AlertActionsProps) {
  const resolve = useServerFn(resolveCampaignAlert);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const external = adsManagerLink(alert.data);
  const isBilling = alert.kind === BILLING_ALERT_KIND;
  const isGoogle = alert.platform === "google";

  const onResolve = async () => {
    setBusy(true);
    try {
      const res = await resolve({ data: { alertId: alert.id } });
      if (res.status === "resolved") toast.success("Alerta marcada como resuelta");
      else toast.info("Esta alerta ya estaba resuelta");
      await queryClient.invalidateQueries({ predicate: showsAlerts });
    } catch (e) {
      toast.error((e as Error).message || "No se pudo marcar la alerta como resuelta");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {isBilling && canResolve && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setCardOpen(true)}
        >
          <CreditCard aria-hidden className="h-3 w-3" />
          Avisar al cliente
        </Button>
      )}
      {isGoogle ? (
        <Link
          to="/clients/$clientId/google-ads"
          params={{ clientId: alert.client_id }}
          className="text-primary hover:underline"
        >
          Ver Google Ads
        </Link>
      ) : external ? (
        <a
          href={external}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Abrir en Meta Ads <ExternalLink aria-hidden className="h-3 w-3" />
        </a>
      ) : (
        <Link
          to="/clients/$clientId/meta-ads"
          params={{ clientId: alert.client_id }}
          className="text-primary hover:underline"
        >
          Ver campañas
        </Link>
      )}
      {canResolve && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={busy}
          onClick={() => void onResolve()}
        >
          {busy ? (
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
          ) : (
            <Check aria-hidden className="h-3 w-3" />
          )}
          Marcar como resuelta
        </Button>
      )}
      {isBilling && (
        <CardUpdateDialog
          open={cardOpen}
          onOpenChange={setCardOpen}
          clientId={alert.client_id}
          verdict={verdictOf(alert.data)}
        />
      )}
    </div>
  );
}
