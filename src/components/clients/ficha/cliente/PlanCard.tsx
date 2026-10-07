import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ErrorState, ListSkeleton, Money } from "@/components/app";
import { chileToday } from "@/lib/dates/chile";
import { PIECES_PER_MONTH } from "@/lib/delivery/planChecklists";
import { isCyclePlan, monthName } from "@/lib/delivery/planCycle";
import {
  INTERVAL_LABEL,
  type PortalBilling,
  type PortalReport,
  type SectionResult,
} from "@/lib/portal/model";
import { findPlan } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";
import type { CycleProgress } from "./clientFichaQueries";
import { previousMonth, shortPeriod } from "./clientView";
import { CLIENT_CARD_CLS } from "./MonthSummaryCard";

interface Deliverable {
  label: string;
  done: number;
  total: number;
  /** Texto a la derecha (por defecto "N de M"). */
  value?: string;
}

function ProgressRow({ item }: { item: Deliverable }) {
  const pct = item.total === 0 ? 0 : Math.min(100, Math.round((item.done / item.total) * 100));
  const complete = item.total > 0 && item.done >= item.total;
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{item.label}</span>
        <span
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            complete ? "text-success-strong" : "text-muted-foreground",
          )}
        >
          {item.value ?? `${Math.min(item.done, item.total)} de ${item.total}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={item.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--gradient-brand)" }}
        />
      </div>
    </li>
  );
}

function deliverables({
  planKey,
  month,
  pieces,
  cycle,
  report,
}: {
  planKey: string | null;
  month: string;
  pieces: number;
  cycle: CycleProgress | undefined;
  report: PortalReport | null;
}): Deliverable[] {
  if (!isCyclePlan(planKey)) return [];
  const items: Deliverable[] = [
    { label: `Piezas de ${monthName(month)}`, done: pieces, total: PIECES_PER_MONTH[planKey] },
  ];
  const calendarKey = cycle?.keys.has("aprobacion") ? "aprobacion" : "calendario";
  if (cycle?.keys.has(calendarKey)) {
    const ok = cycle.doneKeys.has(calendarKey);
    items.push({
      label: calendarKey === "aprobacion" ? "Calendario aprobado" : "Calendario listo",
      done: ok ? 1 : 0,
      total: 1,
      value: ok ? "Listo" : "En curso",
    });
  }
  const prev = previousMonth(month);
  const sent = Boolean(report?.period.startsWith(prev));
  items.push({
    label: `Reporte de ${shortPeriod(`${prev}-01`, chileToday())}`,
    done: sent ? 1 : 0,
    total: 1,
    value: sent ? "Enviado" : "Pendiente",
  });
  return items;
}

interface PlanCardProps {
  clientId: string;
  planKey: string | null;
  month: string;
  pieces: number;
  cycle: CycleProgress | undefined;
  billing: SectionResult<PortalBilling> | undefined;
  report: SectionResult<PortalReport | null> | undefined;
  loading: boolean;
  onRetry: () => void;
}

/** "Tu plan": plan contratado (precio como lo ve el cliente en su portal) y entregables del mes. */
export function PlanCard({
  clientId,
  planKey,
  month,
  pieces,
  cycle,
  billing,
  report,
  loading,
  onRetry,
}: PlanCardProps) {
  const plan = billing?.ok ? billing.data.plan : null;
  const label = plan?.label ?? findPlan(planKey)?.label ?? null;
  const items = deliverables({
    planKey,
    month,
    pieces,
    cycle,
    report: report?.ok ? report.data : null,
  });

  return (
    <section
      aria-label="Tu plan"
      className={cn(CLIENT_CARD_CLS, "flex flex-col gap-3 border-l-4")}
      style={{ borderLeftColor: "var(--brand-2)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow-brand text-[11px] font-semibold uppercase tracking-[0.12em]">
            Tu plan
          </p>
          <h2 className="truncate text-base font-semibold">{label ?? "Sin plan activo"}</h2>
          {plan && (
            <p className="text-xs text-muted-foreground">
              <Money amount={plan.amountClp} className="font-medium text-foreground" />{" "}
              {INTERVAL_LABEL[plan.interval] ?? ""} (total con IVA)
            </p>
          )}
        </div>
        <Link
          to="/clients/$clientId/plan"
          params={{ clientId }}
          className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver plan <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <ListSkeleton rows={3} label="Cargando plan" />
      ) : billing && !billing.ok ? (
        <ErrorState message={billing.error} onRetry={onRetry} />
      ) : items.length > 0 ? (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <ProgressRow key={item.label} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {label ? "Sin entregables mensuales" : "Aún no hay un plan contratado"}
        </p>
      )}
    </section>
  );
}
