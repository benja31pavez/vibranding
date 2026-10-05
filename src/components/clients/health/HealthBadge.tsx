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
  const title =
    health.level === "sin_datos"
      ? "Hay demasiados registros para calcular la salud con certeza"
      : reasons || "Sin señales de riesgo";
  // Los motivos se muestran como texto junto a la pastilla (lista y ficha); el title es solo apoyo.
  return (
    <span title={title} className={className}>
      <StatusBadge status={`salud_${health.level}`} label={meta.label} tone={meta.tone} />
    </span>
  );
}
