import { Link } from "@tanstack/react-router";
import { BellOff } from "lucide-react";
import { EmptyState, FitList, StatusBadge, type StatusTone } from "@/components/app";
import { cn } from "@/lib/utils";
import { AlertActions } from "@/components/alerts/AlertActions";
import { BlockState } from "./block-state";
import { useUserPrefs } from "@/hooks/use-user-prefs";
import { useClientIndex, useOpenCampaignAlerts } from "./queries";

const SEVERITY: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  critical: { label: "Crítica", tone: "danger" },
  warning: { label: "Atención", tone: "warning" },
  info: { label: "Info", tone: "info" },
};

const PLATFORM_LABEL: Readonly<Record<string, string>> = { meta: "Meta", google: "Google" };

/**
 * Pestaña "Alertas": alertas de campañas abiertas, de más a menos severa. Las crea y
 * auto-resuelve el job diario 'campaign_alerts' (/api/public/alerts/run).
 * "Marcar como resuelta" solo se muestra si can_edit_client; el servidor lo vuelve a validar.
 */
export function AlertsTab() {
  const query = useOpenCampaignAlerts();
  const clients = useClientIndex();
  const { formatDateTime } = useUserPrefs();

  return (
    <BlockState query={query} loadingLabel="Cargando alertas de campañas">
      {({ open: alerts, editableClientIds }) =>
        alerts.length === 0 ? (
          <EmptyState
            size="compact"
            icon={BellOff}
            title="Sin alertas abiertas."
            description="Las campañas se revisan cada mañana: gasto sin resultados, costo por resultado al alza, campañas detenidas, problemas con la conexión de Meta y el medio de pago de Google Ads."
          />
        ) : (
          <FitList
            items={alerts}
            getKey={(a) => a.id}
            label="Alertas de campañas"
            sheetDescription="Alertas abiertas, de más a menos severa."
            renderItem={(a, { inSheet }) => {
              const sev = SEVERITY[a.severity] ?? { label: a.severity, tone: "neutral" as const };
              return (
                <div className="space-y-1 py-2 text-sm">
                  <p className={cn("break-words", !inSheet && "line-clamp-2")}>{a.message}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge status={a.severity} label={sev.label} tone={sev.tone} />
                    <span>
                      <Link
                        to="/clients/$clientId"
                        params={{ clientId: a.client_id }}
                        className="hover:underline"
                      >
                        {clients.data?.nameById.get(a.client_id) ?? "Cliente"}
                      </Link>{" "}
                      · {PLATFORM_LABEL[a.platform] ?? a.platform} · {formatDateTime(a.created_at)}
                    </span>
                  </p>
                  <AlertActions alert={a} canResolve={editableClientIds.has(a.client_id)} />
                </div>
              );
            }}
          />
        )
      }
    </BlockState>
  );
}
