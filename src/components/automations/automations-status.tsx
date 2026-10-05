import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ChevronRight } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  Panel,
  StatusBadge,
  type StatusTone,
} from "@/components/app";
import { getAutomationsStatus } from "@/lib/admin/automations.functions";
import { useIsPlatformAdmin } from "@/lib/auth/platformAdmin.functions";
import type { GroupReport, GroupStatus, OverallStatus } from "@/lib/automations/status";
import { RUNS_WINDOW_DAYS } from "@/lib/automations/status";

const REFRESH_MS = 5 * 60_000;

export const OVERALL_TONE: Readonly<Record<OverallStatus, StatusTone>> = {
  ok: "success",
  warning: "warning",
  error: "danger",
  unknown: "neutral",
};

export function groupTone(g: Pick<GroupReport, "status" | "needsAttention">): StatusTone {
  const tones: Readonly<Record<GroupStatus, StatusTone>> = {
    ok: "success",
    error: "danger",
    late: "warning",
    never: g.needsAttention ? "warning" : "neutral",
  };
  return tones[g.status];
}

/** Estado de automatizaciones (cacheado; solo se consulta si `enabled`). */
export function useAutomationsStatus(enabled = true) {
  const fetchStatus = useServerFn(getAutomationsStatus);
  return useQuery({
    queryKey: ["automations-status"],
    enabled,
    refetchInterval: REFRESH_MS,
    staleTime: 60_000,
    queryFn: () => fetchStatus(),
  });
}

export function formatChileDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Resumen de una línea para Inicio: insignia general y enlace al detalle.
 * Solo lo ven administradores de plataforma; para el resto no se renderiza.
 */
export function AutomationsSummaryCard() {
  const admin = useIsPlatformAdmin();
  const isAdmin = admin.data === true;
  const query = useAutomationsStatus(isAdmin);
  if (!isAdmin) return null;

  const data = query.data;
  const badge =
    data && data.available ? (
      <StatusBadge
        status={data.overall}
        label={data.overallLabel}
        tone={OVERALL_TONE[data.overall]}
      />
    ) : data ? (
      <StatusBadge status="unknown" label="Sin información" tone="neutral" />
    ) : null;

  const detail = query.isError
    ? "No se pudo comprobar el estado."
    : !data
      ? "Comprobando…"
      : !data.available
        ? data.message
        : data.attention.length > 0
          ? `Revisar: ${data.attention.join(", ")}.`
          : `${data.groups.filter((g) => g.status === "ok").length} de ${data.groups.length} tareas al día.`;

  return (
    <Panel
      icon={Bot}
      title="Automatizaciones"
      actions={badge}
      tone={
        data?.available && data.overall !== "ok" && data.overall !== "unknown"
          ? "warning"
          : "default"
      }
    >
      <Link
        to="/admin/automatizaciones"
        className="flex items-center justify-between gap-3 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">{detail}</span>
        <span className="flex shrink-0 items-center gap-1 font-medium text-foreground">
          Ver detalle <ChevronRight aria-hidden className="h-4 w-4" />
        </span>
      </Link>
    </Panel>
  );
}

function GroupRow({ group }: { group: GroupReport }) {
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="font-medium">{group.label}</h3>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
        <StatusBadge status={group.status} label={group.statusLabel} tone={groupTone(group)} />
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Horario (Chile)</dt>
          <dd>{group.schedule}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última ejecución</dt>
          <dd>{formatChileDateTime(group.lastRunAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Últimos {RUNS_WINDOW_DAYS} días</dt>
          <dd className={group.failed7d > 0 ? "text-danger-strong" : undefined}>
            {group.runs7d} ejecuciones{group.failed7d > 0 ? ` · ${group.failed7d} con error` : ""}
          </dd>
        </div>
      </dl>
      {group.lastError && (
        <p className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger-strong break-words">
          Último error ({formatChileDateTime(group.lastErrorAt)}): {group.lastError}
        </p>
      )}
      {(group.note || group.inactiveJobs > 0) && (
        <p className="text-xs text-muted-foreground">
          {[
            group.note,
            group.inactiveJobs > 0 ? `${group.inactiveJobs} lote(s) desactivado(s).` : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </li>
  );
}

/** Detalle por grupo de automatizaciones (página /admin/automatizaciones). */
export function AutomationsStatusPanel() {
  const query = useAutomationsStatus(true);
  const data = query.data;

  if (query.isError) {
    return (
      <ErrorState
        message="No se pudo comprobar el estado de las automatizaciones."
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!data) return <ListSkeleton rows={4} label="Cargando automatizaciones" />;
  if (!data.available) {
    return <EmptyState icon={Bot} title="Estado no disponible" description={data.message} />;
  }

  return (
    <Panel
      icon={Bot}
      title="Tareas automáticas"
      description={`Actualizado ${formatChileDateTime(data.checkedAt)}`}
      actions={
        <StatusBadge
          status={data.overall}
          label={data.overallLabel}
          tone={OVERALL_TONE[data.overall]}
        />
      }
    >
      <ul className="divide-y divide-border-subtle">
        {data.groups.map((g) => (
          <GroupRow key={g.id} group={g} />
        ))}
      </ul>
    </Panel>
  );
}
