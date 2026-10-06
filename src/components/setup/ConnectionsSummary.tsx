import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FitPage, PageHeader, StatusBadge } from "@/components/app";
import { cn } from "@/lib/utils";
import { CONNECTION_KEYS, type ConnectionInfo, type ConnectionKey } from "./connectionModel";
import { CONNECTION_ICON, CONNECTION_STATUS } from "./setupConstants";

function ConnectionCard({ clientId, info }: { clientId: string; info: ConnectionInfo }) {
  const Icon = CONNECTION_ICON[info.key];
  const status = CONNECTION_STATUS[info.status];
  const headingId = `conn-${info.key}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-app-lg border bg-surface p-5 shadow-app-xs md:min-h-0",
        info.status === "error" ? "border-danger/40" : "border-border-subtle",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-app-md bg-surface-2">
            <Icon className="h-5 w-5 text-foreground" />
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-base font-semibold text-foreground">
              {info.label}
            </h2>
            <p className="truncate text-sm text-muted-foreground" title={info.account ?? undefined}>
              {info.account ?? "Sin cuenta vinculada"}
            </p>
          </div>
        </div>
        <StatusBadge status={`conn-${info.status}`} label={status.label} tone={status.tone} />
      </div>

      <ol className="space-y-1.5 md:min-h-0 md:overflow-hidden">
        {info.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            {s.state === "done" ? (
              <Check aria-hidden className="h-4 w-4 shrink-0 text-success-strong" />
            ) : s.state === "blocked" ? (
              <Lock aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <span aria-hidden className="mx-1 h-2 w-2 shrink-0 rounded-full bg-info" />
            )}
            <span
              className={cn(
                "min-w-0 truncate",
                s.state === "done" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.title}
            </span>
            <span className="sr-only">
              {s.state === "done"
                ? "(listo)"
                : s.state === "blocked"
                  ? "(bloqueado)"
                  : "(pendiente)"}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{info.note}</span>
        <Button asChild size="sm" variant={info.status === "pending" ? "default" : "outline"}>
          <Link
            to="/clients/$clientId/setup"
            params={{ clientId }}
            search={{ conexion: info.key }}
            aria-label={`${info.status === "pending" ? "Conectar" : "Administrar"} ${info.label}`}
          >
            {info.status === "pending" ? "Conectar" : "Administrar"}
            <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** Resumen: las cuatro conexiones del cliente, independientes entre sí. */
export function ConnectionsSummary({
  clientId,
  connections,
}: {
  clientId: string;
  connections: Record<ConnectionKey, ConnectionInfo>;
}) {
  const list = CONNECTION_KEYS.map((k) => connections[k]);
  const connected = list.filter((c) => c.status === "connected").length;
  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Conexiones"
          actions={
            <StatusBadge
              status={connected === list.length ? "setup_done" : "setup_pending"}
              label={`${connected} de ${list.length} conectadas`}
              tone={connected === list.length ? "success" : "neutral"}
            />
          }
        />
      }
      contentClassName="grid gap-4 md:grid-cols-2 md:grid-rows-2"
    >
      {list.map((info) => (
        <ConnectionCard key={info.key} clientId={clientId} info={info} />
      ))}
    </FitPage>
  );
}
