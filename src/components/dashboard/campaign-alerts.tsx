import { Link } from "@tanstack/react-router";
import { BellRing, BellOff } from "lucide-react";
import { EmptyState, Panel, StatusBadge, type StatusTone } from "@/components/app";
import { AlertActions } from "@/components/alerts/AlertActions";
import { BlockState } from "./block-state";
import { formatShortDate, useClientIndex, useOpenCampaignAlerts } from "./queries";

const VISIBLE_ALERTS = 6;

const SEVERITY: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  critical: { label: "Crítica", tone: "danger" },
  warning: { label: "Atención", tone: "warning" },
  info: { label: "Info", tone: "info" },
};

const PLATFORM_LABEL: Readonly<Record<string, string>> = { meta: "Meta", google: "Google" };

/**
 * Alertas de campañas abiertas, de más a menos severa. Las crea y auto-resuelve
 * el job diario 'campaign_alerts' (/api/public/alerts/run). Si la tabla nunca
 * tuvo filas el bloque se oculta (aún no corrió o no hay clientes con Meta).
 * "Marcar como resuelta" solo se muestra si can_edit_client; el servidor lo vuelve a validar.
 */
export function CampaignAlerts() {
  const query = useOpenCampaignAlerts();
  const clients = useClientIndex();
  const count = query.data?.open.length ?? 0;

  if (query.data && query.data.everCount === 0) return null;

  return (
    <Panel
      icon={BellRing}
      title={count ? `Alertas de campañas (${count})` : "Alertas de campañas"}
      tone={query.data?.open.some((a) => a.severity === "critical") ? "warning" : "default"}
    >
      <BlockState query={query} loadingLabel="Cargando alertas de campañas">
        {({ open: alerts, editableClientIds }) =>
          alerts.length === 0 ? (
            <EmptyState
              size="compact"
              icon={BellOff}
              title="Sin alertas abiertas."
              description="Las campañas se revisan cada mañana: gasto sin resultados, costo por resultado al alza, campañas detenidas y problemas con la conexión de Meta."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {alerts.slice(0, VISIBLE_ALERTS).map((a) => {
                const sev = SEVERITY[a.severity] ?? { label: a.severity, tone: "neutral" as const };
                return (
                  <li key={a.id} className="flex items-start gap-3 py-2 text-sm">
                    <StatusBadge
                      status={a.severity}
                      label={sev.label}
                      tone={sev.tone}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words">{a.message}</p>
                      <p className="text-xs text-muted-foreground">
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: a.client_id }}
                          className="hover:underline"
                        >
                          {clients.data?.nameById.get(a.client_id) ?? "Cliente"}
                        </Link>{" "}
                        · {PLATFORM_LABEL[a.platform] ?? a.platform} ·{" "}
                        {formatShortDate(a.created_at)}
                      </p>
                      <AlertActions alert={a} canResolve={editableClientIds.has(a.client_id)} />
                    </div>
                  </li>
                );
              })}
              {alerts.length > VISIBLE_ALERTS && (
                <li className="pt-2 text-xs text-muted-foreground">
                  y {alerts.length - VISIBLE_ALERTS} más…
                </li>
              )}
            </ul>
          )
        }
      </BlockState>
    </Panel>
  );
}
