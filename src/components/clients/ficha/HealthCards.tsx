import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Megaphone, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyTotals, TONE_CLASSES, type StatusTone } from "@/components/app";
import { addMoney, type MoneyByCurrency } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";
import type { FichaHealth } from "./fichaQueries";

interface HealthCardsProps {
  clientId: string;
  health: FichaHealth | undefined;
  loading: boolean;
}

function totalsByCurrency(rows: FichaHealth["payments"]): MoneyByCurrency {
  return rows.reduce<MoneyByCurrency>((acc, p) => addMoney(acc, p.currency, Number(p.amount)), {});
}

/** Tres semáforos: entregas por aprobar, cobros abiertos y alertas de campañas. */
export function HealthCards({ clientId, health, loading }: HealthCardsProps) {
  const approvals = health?.approvals.length ?? 0;
  const pending = health?.payments.filter((p) => p.status === "pending") ?? [];
  const overdue = health?.payments.filter((p) => p.status === "overdue") ?? [];
  const alerts = health?.alerts ?? [];
  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <HealthCard
        icon={ClipboardCheck}
        title="Entregas"
        loading={loading}
        tone={approvals > 0 ? "warning" : "success"}
        summary={approvals > 0 ? `${approvals} por aprobar` : "Nada pendiente de aprobación"}
        link={<Link to="/clients/$clientId/deliverables" params={{ clientId }}>Ver entregas</Link>}
      />
      <HealthCard
        icon={Wallet}
        title="Pagos"
        loading={loading}
        tone={overdue.length > 0 ? "danger" : pending.length > 0 ? "warning" : "success"}
        summary={
          overdue.length + pending.length === 0 ? (
            "Sin cobros abiertos"
          ) : (
            <span className="space-x-1">
              {overdue.length > 0 && (
                <span>{overdue.length} vencido{overdue.length === 1 ? "" : "s"} (<MoneyTotals totals={totalsByCurrency(overdue)} />)</span>
              )}
              {overdue.length > 0 && pending.length > 0 && <span>·</span>}
              {pending.length > 0 && (
                <span>{pending.length} pendiente{pending.length === 1 ? "" : "s"} (<MoneyTotals totals={totalsByCurrency(pending)} />)</span>
              )}
            </span>
          )
        }
        link={<Link to="/clients/$clientId/facturacion" params={{ clientId }} search={{ tab: "pagos" }}>Ver pagos</Link>}
      />
      <HealthCard
        icon={Megaphone}
        title="Campañas"
        loading={loading}
        tone={critical > 0 ? "danger" : alerts.length > 0 ? "warning" : "success"}
        summary={alerts.length > 0 ? `${alerts.length} alerta${alerts.length === 1 ? "" : "s"} abierta${alerts.length === 1 ? "" : "s"}` : "Sin alertas abiertas"}
        link={<Link to="/clients/$clientId/meta-ads" params={{ clientId }}>Ver campañas</Link>}
      />
    </div>
  );
}

interface HealthCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary: ReactNode;
  tone: StatusTone;
  loading: boolean;
  link: ReactNode;
}

function HealthCard({ icon: Icon, title, summary, tone, loading, link }: HealthCardProps) {
  const ok = tone === "success";
  const StateIcon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex items-start gap-3 rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs">
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", TONE_CLASSES[tone].badge)}>
        {loading ? <Icon aria-hidden className="h-4 w-4" /> : <StateIcon aria-hidden className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon aria-hidden className="h-3.5 w-3.5" /> {title}
        </div>
        {loading ? (
          <Skeleton className="mt-1.5 h-4 w-32" />
        ) : (
          <div className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{summary}</div>
        )}
        <div className="mt-1 text-xs text-primary hover:underline">{link}</div>
      </div>
    </div>
  );
}
