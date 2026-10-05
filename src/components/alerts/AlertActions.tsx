import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";
import { resolveCampaignAlert } from "@/lib/alerts/campaignAlerts.functions";

const ADS_MANAGER_PREFIX = "https://adsmanager.facebook.com/adsmanager/";

/** Link al Administrador de anuncios guardado por el motor; solo se acepta el dominio de Meta. */
function adsManagerLink(data: Json | undefined): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const url = (data as Record<string, Json | undefined>).ads_manager_url;
  return typeof url === "string" && url.startsWith(ADS_MANAGER_PREFIX) ? url : null;
}

/** Queries que muestran alertas abiertas: "Hoy" y la salud de la ficha. */
function showsAlerts(query: Query): boolean {
  const key = query.queryKey;
  return (
    (key[0] === "dashboard-hoy" && key.includes("campaign-alerts")) ||
    (key[0] === "ficha" && key[3] === "health")
  );
}

interface AlertActionsProps {
  alert: { id: string; client_id: string; data?: Json };
  /** Editores del cliente; los demás solo ven los links. */
  canResolve?: boolean;
}

/** "Marcar como resuelta" + link a Meta Ads del cliente para una alerta de campaña. */
export function AlertActions({ alert, canResolve = true }: AlertActionsProps) {
  const resolve = useServerFn(resolveCampaignAlert);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const external = adsManagerLink(alert.data);

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
      {external ? (
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
          {busy ? <Loader2 aria-hidden className="h-3 w-3 animate-spin" /> : <Check aria-hidden className="h-3 w-3" />}
          Marcar como resuelta
        </Button>
      )}
    </div>
  );
}
