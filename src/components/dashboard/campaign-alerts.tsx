import { Link } from "@tanstack/react-router";
import { BellRing, BellOff } from "lucide-react";
import { EmptyState, Panel, StatusBadge, type StatusTone } from "@/components/app";
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
 * Alertas de campañas abiertas, de más a menos severa.
 * Hoy ningún proceso automático escribe en campaign_alerts: si la tabla nunca
 * tuvo filas el bloque se oculta, para no sugerir que algo está vigilando.
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
        {({ open: alerts }) =>
          alerts.length === 0 ? (
            <EmptyState
              size="compact"
              icon={BellOff}
              title="Sin alertas abiertas."
              description="Las alertas automáticas de campañas aún no están activas: aquí solo aparecen las que se registren a mano o por integraciones."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {alerts.slice(0, VISIBLE_ALERTS).map((a) => {
                const sev = SEVERITY[a.severity] ?? { label: a.severity, tone: "neutral" as const };
                return (
                  <li key={a.id} className="flex items-start gap-3 py-2 text-sm">
                    <StatusBadge status={a.severity} label={sev.label} tone={sev.tone} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words">{a.message}</p>
                      <p className="text-xs text-muted-foreground">
                        <Link to="/clients/$clientId" params={{ clientId: a.client_id }} className="hover:underline">
                          {clients.data?.nameById.get(a.client_id) ?? "Cliente"}
                        </Link>{" "}
                        · {PLATFORM_LABEL[a.platform] ?? a.platform} · {formatShortDate(a.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
              {alerts.length > VISIBLE_ALERTS && (
                <li className="pt-2 text-xs text-muted-foreground">y {alerts.length - VISIBLE_ALERTS} más…</li>
              )}
            </ul>
          )
        }
      </BlockState>
    </Panel>
  );
}
