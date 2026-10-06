import { useState } from "react";
import { CalendarCheck, CalendarRange, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FOLLOWUPS_INFO,
  FollowupsPanel,
  useFollowupActions,
} from "@/components/followups/FollowupsPanel";
import { findPlan } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";
import { FichaCard } from "./FichaCard";
import { FichaSheet } from "./FichaSheet";
import type { FichaHealth, FichaOverview } from "./fichaQueries";
import { PendingApprovalPanel, UpcomingContentPanel } from "./MainPanels";
import { MonthPlanInfo, MonthPlanPanel } from "./MonthPlanPanel";

type WorkTab = "approvals" | "upcoming";

const HEAD_BUTTON = "h-7 px-2 text-xs";

interface WorkPanelProps {
  clientId: string;
  overview: FichaOverview | undefined;
  health: FichaHealth | undefined;
  healthLoading: boolean;
  healthError: Error | null;
  onRetryHealth: () => void;
  upcomingCount: number;
}

function TabButton({
  active,
  label,
  count,
  onClick,
  controls,
}: {
  active: boolean;
  label: string;
  count: number | undefined;
  onClick: () => void;
  controls: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "inline-flex min-w-0 flex-auto items-center justify-center gap-1.5 rounded-app-sm px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-surface text-foreground shadow-app-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-surface-2 px-1.5 tabular-nums">{count}</span>
      )}
    </button>
  );
}

/**
 * "Trabajo del mes": lo que espera aprobación y lo próximo a publicar (una
 * lista a la vez, a todo el alto), con el plan del mes y los seguimientos
 * sugeridos en paneles laterales.
 */
export function WorkPanel({
  clientId,
  overview,
  health,
  healthLoading,
  healthError,
  onRetryHealth,
  upcomingCount,
}: WorkPanelProps) {
  const followups = useFollowupActions({ scope: { clientId } });
  const [followupsOpen, setFollowupsOpen] = useState(false);
  const [monthPlanOpen, setMonthPlanOpen] = useState(false);
  const approvals = health?.approvals.length;
  const [tab, setTab] = useState<WorkTab | null>(null);
  // Sin elección del usuario: abre en lo que espera aprobación, si hay algo.
  const active: WorkTab = tab ?? (approvals === 0 && upcomingCount > 0 ? "upcoming" : "approvals");
  const pendingFollowups = followups.visible.length;
  const canEdit = Boolean(overview?.canEdit);
  const planLabel = findPlan(overview?.billing?.plan_key)?.label;

  return (
    <FichaCard
      title="Trabajo del mes"
      icon={CalendarCheck}
      fill
      actions={
        <>
          {pendingFollowups > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={HEAD_BUTTON}
              aria-haspopup="dialog"
              title="Seguimientos sugeridos"
              onClick={() => setFollowupsOpen(true)}
            >
              <Send aria-hidden className="mr-1 h-3.5 w-3.5" />
              {pendingFollowups}
              <span className="sr-only"> seguimientos sugeridos</span>
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={HEAD_BUTTON}
              aria-haspopup="dialog"
              title={planLabel ? `Plan del mes · ${planLabel}` : "Plan del mes"}
              onClick={() => setMonthPlanOpen(true)}
            >
              <CalendarRange aria-hidden className="h-3.5 w-3.5 min-[1400px]:mr-1" />
              <span className="sr-only min-[1400px]:not-sr-only">Plan del mes</span>
            </Button>
          )}
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-2.5 md:min-h-0 md:flex-1">
        <div
          role="tablist"
          aria-label="Trabajo del mes"
          className="flex shrink-0 gap-1 rounded-app-md bg-surface-2 p-1"
        >
          <TabButton
            active={active === "approvals"}
            label="Por aprobar"
            count={approvals}
            onClick={() => setTab("approvals")}
            controls="ficha-work-approvals"
          />
          <TabButton
            active={active === "upcoming"}
            label="Próximo contenido"
            count={upcomingCount}
            onClick={() => setTab("upcoming")}
            controls="ficha-work-upcoming"
          />
        </div>
        <div
          id={active === "approvals" ? "ficha-work-approvals" : "ficha-work-upcoming"}
          role="tabpanel"
          className="flex min-w-0 flex-col md:min-h-0 md:flex-1"
        >
          {active === "approvals" ? (
            <PendingApprovalPanel
              clientId={clientId}
              health={health}
              loading={healthLoading}
              error={healthError}
              onRetry={onRetryHealth}
            />
          ) : (
            <UpcomingContentPanel clientId={clientId} />
          )}
        </div>
      </div>
      {overview && canEdit && (
        <FichaSheet
          open={monthPlanOpen}
          onOpenChange={setMonthPlanOpen}
          title="Plan del mes"
          info={<MonthPlanInfo clientId={clientId} />}
        >
          <MonthPlanPanel
            clientId={clientId}
            planKey={overview.billing?.plan_key ?? null}
            canEdit={overview.canEdit}
          />
        </FichaSheet>
      )}
      <FichaSheet
        open={followupsOpen}
        onOpenChange={setFollowupsOpen}
        title="Seguimientos sugeridos"
        info={FOLLOWUPS_INFO}
        wide
      >
        <FollowupsPanel scope={{ clientId }} />
      </FichaSheet>
    </FichaCard>
  );
}
