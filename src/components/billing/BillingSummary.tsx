import type { ComponentType, ReactNode } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, RotateCw, Target } from "lucide-react";
import { Money, MoneyTotals } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMrr } from "@/lib/billing/mrr";
import { UPCOMING_DAYS } from "@/lib/billing/openPayments";
import { computeGoal, META_DEADLINE_MONTH } from "@/lib/growth/goal";
import { EMPTY_CLP_TOTALS, META_MRR_CLP, type ClpTotals } from "@/lib/pricing/plans";
import { todayInChile } from "@/lib/billing/dates";
import { cn } from "@/lib/utils";
import type { BillingFilter, OpenSummary } from "./billingData";

const PCT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const DEADLINE_LABEL = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${META_DEADLINE_MONTH}-15T12:00:00Z`));

const TILE = "min-w-0 rounded-app-lg border px-4 py-3 text-left shadow-app-xs";

const countLabel = (n: number) => `${n} ${n === 1 ? "cobro" : "cobros"}`;

interface TileProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  loading: boolean;
  children: ReactNode;
  hint?: ReactNode;
  danger?: boolean;
  /** Si existe, la tarjeta filtra la lista al hacer clic. */
  onSelect?: () => void;
  selected?: boolean;
}

function Tile({
  label,
  icon: Icon,
  loading,
  children,
  hint,
  danger,
  onSelect,
  selected,
}: TileProps) {
  const body = (
    <>
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          danger ? "text-danger-strong" : "text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="h-3.5 w-3.5" />
        {label}
      </span>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <span
          className={cn(
            "mt-1 block truncate text-2xl font-semibold tracking-tight tabular-nums",
            danger && "text-danger-strong",
          )}
        >
          {children}
        </span>
      )}
      {!loading && hint && (
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span>
      )}
    </>
  );
  const tone = danger ? "border-danger/40 bg-danger-subtle" : "border-border-subtle bg-surface";
  if (!onSelect) return <div className={cn(TILE, tone)}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        TILE,
        tone,
        "transition-shadow hover:shadow-app-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-primary/40",
      )}
    >
      {body}
    </button>
  );
}

function MrrGoalTile() {
  const mrr = useMrr();
  const loading = mrr.isPending && !mrr.isError;
  const label = "MRR neto vs meta";
  if (mrr.isError) {
    return (
      <div className={cn(TILE, "border-border-subtle bg-surface")}>
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Target aria-hidden className="h-3.5 w-3.5" />
          {label}
        </span>
        <span role="alert" className="mt-2 flex items-center gap-2 text-sm text-danger-strong">
          No disponible
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={mrr.isFetching}
            onClick={() => void mrr.refetch()}
          >
            <RotateCw aria-hidden className="mr-1 h-3.5 w-3.5" />
            Reintentar
          </Button>
        </span>
      </div>
    );
  }
  const goal = mrr.data
    ? computeGoal({
        mrr: mrr.data.total,
        goal: META_MRR_CLP,
        recurringClients: mrr.data.subscriptionClients + mrr.data.billingClients,
        fallbackTicket: 0,
        currentMonth: todayInChile().slice(0, 7),
      })
    : null;
  const width = goal ? Math.min(100, Math.max(0, goal.progressPct)) : 0;
  return (
    <div className={cn(TILE, "border-border-subtle bg-surface")}>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Target aria-hidden className="h-3.5 w-3.5" />
          {label}
        </span>
        {goal && (
          <span className="tabular-nums text-foreground">{PCT.format(goal.progressPct)} %</span>
        )}
      </span>
      {loading || !goal ? (
        <>
          <Skeleton className="mt-2 h-7 w-28" />
          <span className="sr-only">Cargando MRR</span>
        </>
      ) : (
        <>
          <span className="mt-1 flex items-baseline gap-1.5 truncate">
            <Money amount={goal.mrr} className="text-2xl font-semibold tracking-tight" />
            <span className="truncate text-xs text-muted-foreground">
              de <Money amount={META_MRR_CLP} />
            </span>
          </span>
          <span
            role="progressbar"
            aria-label="Avance hacia la meta de MRR"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(width)}
            className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
          >
            <span
              className={cn(
                "block h-full rounded-full",
                goal.gap === 0 ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${width}%` }}
            />
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {goal.gap === 0 ? (
              "Meta cumplida"
            ) : (
              <>
                Faltan <Money amount={goal.gap} /> · plazo {DEADLINE_LABEL}
              </>
            )}
          </span>
        </>
      )}
    </div>
  );
}

export interface BillingSummaryProps {
  loading: boolean;
  open: OpenSummary | null;
  collectedThisMonth: ClpTotals;
  /** Todo lo abierto (pendiente + vencido). */
  receivable: ClpTotals;
  filter: BillingFilter;
  onFilter: (filter: BillingFilter) => void;
}

/**
 * Franja de Cobros: lo vencido (en rojo si hay), lo que vence en los próximos
 * días, lo cobrado del mes y el MRR neto frente a la meta. Las dos primeras
 * tarjetas filtran la lista.
 */
export function BillingSummary({
  loading,
  open,
  collectedThisMonth,
  receivable,
  filter,
  onFilter,
}: BillingSummaryProps) {
  const overdue = open?.overdue;
  const dueSoon = open?.dueSoon;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Vencido"
        icon={AlertCircle}
        loading={loading}
        danger={(overdue?.count ?? 0) > 0}
        hint={overdue && overdue.count > 0 ? countLabel(overdue.count) : "Todo al día"}
        onSelect={() => onFilter("vencidos")}
        selected={filter === "vencidos"}
      >
        <MoneyTotals totals={overdue?.totals ?? EMPTY_CLP_TOTALS} />
      </Tile>
      <Tile
        label={`Vence en ${UPCOMING_DAYS} días`}
        icon={CalendarClock}
        loading={loading}
        hint={dueSoon && dueSoon.count > 0 ? countLabel(dueSoon.count) : "Nada por vencer"}
        onSelect={() => onFilter("por_vencer")}
        selected={filter === "por_vencer"}
      >
        <MoneyTotals totals={dueSoon?.totals ?? EMPTY_CLP_TOTALS} />
      </Tile>
      <Tile
        label="Cobrado este mes"
        icon={CheckCircle2}
        loading={loading}
        hint={
          <>
            Por cobrar en total <MoneyTotals totals={receivable} />
          </>
        }
      >
        <MoneyTotals totals={collectedThisMonth} />
      </Tile>
      <MrrGoalTile />
    </div>
  );
}
