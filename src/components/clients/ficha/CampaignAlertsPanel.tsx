import { BellRing } from "lucide-react";
import { Panel, StatusBadge, type StatusTone } from "@/components/app";
import { AlertActions } from "@/components/alerts/AlertActions";
import { formatDate, type FichaHealth } from "./fichaQueries";

const SEVERITY: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  critical: { label: "Crítica", tone: "danger" },
  warning: { label: "Atención", tone: "warning" },
  info: { label: "Info", tone: "info" },
};
const SEVERITY_RANK: Readonly<Record<string, number>> = { critical: 0, warning: 1, info: 2 };

interface CampaignAlertsPanelProps {
  alerts: FichaHealth["alerts"];
  canEdit: boolean;
}

/** Alertas de campañas abiertas del cliente, con acción para resolverlas. Se oculta si no hay. */
export function CampaignAlertsPanel({ alerts, canEdit }: CampaignAlertsPanelProps) {
  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) || b.created_at.localeCompare(a.created_at),
  );
  return (
    <Panel
      icon={BellRing}
      title={`Alertas de campañas (${alerts.length})`}
      tone={alerts.some((a) => a.severity === "critical") ? "warning" : "default"}
    >
      <ul className="divide-y divide-border-subtle">
        {sorted.map((a) => {
          const sev = SEVERITY[a.severity] ?? { label: a.severity, tone: "neutral" as const };
          return (
            <li key={a.id} className="flex items-start gap-3 py-2 text-sm">
              <StatusBadge status={a.severity} label={sev.label} tone={sev.tone} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="break-words">{a.message}</p>
                <p className="text-xs text-muted-foreground">Detectada el {formatDate(a.created_at)}</p>
                <AlertActions alert={a} canResolve={canEdit} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
