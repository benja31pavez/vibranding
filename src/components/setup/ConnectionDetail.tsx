import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { FitPage, PageHeader, StatusBadge } from "@/components/app";
import { cn } from "@/lib/utils";
import { initialStep, type ConnectionInfo, type StepKey } from "./connectionModel";
import { CONNECTION_ICON, CONNECTION_STATUS, STEP_STATE } from "./setupConstants";
import { StepBody } from "./StepBody";
import type { ConnectionsState } from "./useConnections";

function StepMarker({ state, n }: { state: ConnectionInfo["steps"][number]["state"]; n: number }) {
  return (
    <span
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
        state === "done" && "bg-primary text-primary-foreground",
        state === "blocked" && "bg-surface-2 text-muted-foreground",
        state === "available" && "border border-primary text-primary",
      )}
    >
      {state === "done" ? (
        <Check aria-hidden className="h-4 w-4" />
      ) : state === "blocked" ? (
        <Lock aria-hidden className="h-3 w-3" />
      ) : (
        n
      )}
    </span>
  );
}

/**
 * Una conexión: sus pasos a la izquierda y el paso elegido a la derecha (con
 * scroll interno). Cada paso solo se bloquea por pasos de esta misma conexión.
 */
export function ConnectionDetail({
  clientId,
  info,
  state,
}: {
  clientId: string;
  info: ConnectionInfo;
  state: ConnectionsState;
}) {
  const [selected, setSelected] = useState<StepKey>(() => initialStep(info));
  const index = Math.max(
    0,
    info.steps.findIndex((s) => s.key === selected),
  );
  const step = info.steps[index];
  const blocker = step.blockedBy ? info.steps.find((s) => s.key === step.blockedBy) : undefined;
  const Icon = CONNECTION_ICON[info.key];
  const status = CONNECTION_STATUS[info.status];
  const doneCount = info.steps.filter((s) => s.state === "done").length;

  return (
    <FitPage
      header={
        <div className="space-y-2">
          <PageHeader
            size="compact"
            title={
              <span className="flex items-center gap-2.5">
                <Icon className="h-6 w-6 text-muted-foreground" />
                {info.label}
              </span>
            }
            actions={
              <>
                {info.account && (
                  <span className="max-w-xs truncate text-sm text-muted-foreground">
                    {info.account}
                  </span>
                )}
                <StatusBadge
                  status={`conn-${info.status}`}
                  label={status.label}
                  tone={status.tone}
                />
              </>
            }
          />
        </div>
      }
      contentClassName="grid gap-4 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)]"
    >
      <nav
        aria-label={`Pasos de ${info.label}`}
        className="flex flex-col gap-3 rounded-app-lg border border-border-subtle bg-surface p-3 shadow-app-xs md:min-h-0 md:overflow-y-auto"
      >
        <p className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {doneCount} de {info.steps.length} pasos
        </p>
        <ol className="space-y-1">
          {info.steps.map((s, i) => {
            const active = s.key === step.key;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => setSelected(s.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-app-md px-2 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
                  )}
                >
                  <StepMarker state={s.state} n={i + 1} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-sm font-medium",
                      s.state === "blocked" && "text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {info.note && (
          <p className="mt-auto px-2 pb-1 text-xs text-muted-foreground">{info.note}</p>
        )}
      </nav>

      <section
        aria-labelledby="step-title"
        className="flex flex-col rounded-app-lg border border-border-subtle bg-surface shadow-app-xs md:min-h-0"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
          <h2 id="step-title" className="text-base font-semibold">
            <span className="mr-2 text-muted-foreground">{index + 1}.</span>
            {step.title}
          </h2>
          <StatusBadge
            status={`setup_${step.state}`}
            label={STEP_STATE[step.state].label}
            tone={STEP_STATE[step.state].tone}
          />
        </header>
        <div className="min-h-0 flex-1 p-5 md:overflow-y-auto">
          {step.state === "blocked" && blocker ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Primero completa «{blocker.title}» de {info.label}.
              </p>
              <button
                type="button"
                onClick={() => setSelected(blocker.key)}
                className="text-sm font-medium text-primary hover:underline"
              >
                Ir a «{blocker.title}»
              </button>
            </div>
          ) : (
            <StepBody step={step.key} clientId={clientId} state={state} />
          )}
        </div>
      </section>
    </FitPage>
  );
}
