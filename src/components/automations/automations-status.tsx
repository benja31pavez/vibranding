import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
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

const DOT_TONE: Readonly<Record<StatusTone, string>> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-primary",
  neutral: "bg-muted-foreground",
};

/**
 * Insignia del encabezado de Inicio: punto de color con el estado general de las
 * automatizaciones y enlace al detalle. Solo la ven administradores de plataforma.
 */
export function AutomationsStatusBadge() {
  const admin = useIsPlatformAdmin();
  const isAdmin = admin.data === true;
  const query = useAutomationsStatus(isAdmin);
  if (!isAdmin) return null;

  const data = query.data;
  const tone: StatusTone = query.isError
    ? "danger"
    : data?.available
      ? OVERALL_TONE[data.overall]
      : "neutral";
  const status = query.isError
    ? "No se pudo comprobar"
    : !data
      ? "Comprobando…"
      : data.available
        ? data.overallLabel
        : "Sin información";
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
    <Link
      to="/admin/automatizaciones"
      title={detail}
      className="inline-flex h-8 items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 text-xs text-muted-foreground shadow-app-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT_TONE[tone])} />
      <Bot aria-hidden className="h-3.5 w-3.5" />
      <span>
        Automatizaciones: <span className="font-medium text-foreground">{status}</span>
      </span>
      <span className="sr-only">. {detail} Ver detalle.</span>
    </Link>
  );
}

/**
 * Versión compacta para el pie del menú lateral: punto de color + texto corto.
 * Mientras carga no dice "Comprobando…" (no aporta): se omite hasta tener respuesta.
 */
export function AutomationsStatusFooter() {
  const admin = useIsPlatformAdmin();
  const isAdmin = admin.data === true;
  const query = useAutomationsStatus(isAdmin);
  if (!isAdmin) return null;
  const data = query.data;
  if (!data && !query.isError) return null;
  const tone: StatusTone = query.isError
    ? "danger"
    : data?.available
      ? OVERALL_TONE[data.overall]
      : "neutral";
  const text = query.isError
    ? "Automatizaciones: sin comprobar"
    : !data?.available
      ? "Automatizaciones: sin información"
      : data.attention.length > 0
        ? `Automatizaciones: revisar ${data.attention.length}`
        : "Automatizaciones al día";
  return (
    <Link
      to="/admin/automatizaciones"
      className="sb-muted flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fb2ff]"
    >
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT_TONE[tone])} />
      <span className="truncate">{text}</span>
    </Link>
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
