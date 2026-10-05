import { StatusBadge } from "@/components/app";
import { Skeleton } from "@/components/ui/skeleton";
import { HEALTH_LEVEL_META, type ClientHealth } from "@/lib/health";

export interface HealthBadgeProps {
  health: ClientHealth | undefined;
  loading?: boolean;
  className?: string;
}

/** Pastilla Bien / Atención / En riesgo. El tooltip nativo lista los motivos. */
export function HealthBadge({ health, loading, className }: HealthBadgeProps) {
  if (loading) return <Skeleton className="h-5 w-20 rounded-full" />;
  if (!health) return null;
  const meta = HEALTH_LEVEL_META[health.level];
  const reasons = health.reasons.map((r) => r.label).join(" · ");
  return (
    <span title={reasons || "Sin señales de riesgo"} className={className}>
      <StatusBadge status={`salud_${health.level}`} label={meta.label} tone={meta.tone} />
      {reasons && <span className="sr-only">: {reasons}</span>}
    </span>
  );
}
