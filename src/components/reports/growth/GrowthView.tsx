import { useState } from "react";
import { DEFAULT_FUNNEL_DAYS, type FunnelRangeDays } from "./growthQueries";
import { FunnelPanel } from "./FunnelPanel";
import { GoalPanel } from "./GoalPanel";
import { PendingProposalsPanel } from "./PendingProposalsPanel";

/** Pestaña "Crecimiento" de /reports: meta de MRR, embudo, fuentes y propuestas pendientes. */
export function GrowthView() {
  const [days, setDays] = useState<FunnelRangeDays>(DEFAULT_FUNNEL_DAYS);
  return (
    <div className="space-y-6">
      <GoalPanel />
      <FunnelPanel days={days} onDaysChange={setDays} />
      <PendingProposalsPanel />
    </div>
  );
}
