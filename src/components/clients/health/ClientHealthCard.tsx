import { HeartPulse, Lightbulb } from "lucide-react";
import { ErrorState, ListSkeleton, Panel, TONE_CLASSES } from "@/components/app";
import { HEALTH_LEVEL_META } from "@/lib/health";
import { cn } from "@/lib/utils";
import { HealthBadge } from "./HealthBadge";
import { HEALTH_LOAD_ERROR, useClientHealth } from "./healthQueries";

const SEVERITY_TONE = { risk: "danger", warning: "warning" } as const;

/** Tarjeta de la ficha: nivel de salud, motivos y siguiente acción sugerida. */
export function ClientHealthCard({ clientId }: { clientId: string }) {
  const query = useClientHealth(clientId);
  const { health } = query;

  if (query.isError) {
    return (
      <ErrorState
        title="No pudimos calcular la salud del cliente"
        message={HEALTH_LOAD_ERROR}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  // Prospectos y clientes terminados no se puntúan.
  if (!query.isPending && !health) return null;

  return (
    <Panel
      title="Salud del cliente"
      icon={HeartPulse}
      actions={<HealthBadge health={health} loading={query.isPending} />}
      tone={health?.level === "en_riesgo" ? "warning" : "default"}
    >
      {query.isPending || !health ? (
        <ListSkeleton rows={2} label="Calculando salud del cliente" />
      ) : health.level === "sin_datos" ? (
        <p className="text-sm text-muted-foreground">
          Sin datos suficientes: este cliente tiene demasiados registros para calcular su salud con
          certeza.
        </p>
      ) : health.reasons.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todo en orden: sin cobros vencidos, aprobaciones trabadas ni alertas abiertas.
        </p>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1.5" aria-label="Motivos">
            {health.reasons.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    TONE_CLASSES[SEVERITY_TONE[r.severity]].dot,
                  )}
                />
                <span>
                  {r.label}
                  <span className="sr-only">
                    {" "}
                    ({r.severity === "risk" ? "riesgo" : "atención"})
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {health.nextAction && (
            <p className="flex items-start gap-2 rounded-app-md bg-surface-2 p-3 text-sm">
              <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="font-medium">Siguiente paso: </span>
                {health.nextAction}
              </span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Puntaje {health.score}/100 · {HEALTH_LEVEL_META[health.level].label}
          </p>
        </div>
      )}
    </Panel>
  );
}
