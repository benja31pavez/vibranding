import { useEffect, useRef, useState } from "react";

export const OUTCOME_STATES = [
  { key: "unanswered", label: "Sin responder", short: "Sin resp." },
  { key: "answered", label: "Respondida", short: "Respondida" },
  { key: "qualified", label: "Calificada", short: "Calificada" },
  { key: "closed", label: "Cerrada", short: "Cerrada" },
] as const;

export type OutcomeStatus = (typeof OUTCOME_STATES)[number]["key"];

export type Outcome = {
  conversation_id: string;
  status: OutcomeStatus;
  value_clp: number | null;
};

const ACTIVE: Record<OutcomeStatus, string> = {
  unanswered: "bg-muted-foreground/80 text-background border-muted-foreground/80",
  answered: "bg-sky-500 text-white border-sky-500",
  qualified: "bg-amber-500 text-white border-amber-500",
  closed: "bg-emerald-600 text-white border-emerald-600",
};

/**
 * One tap = one state change. "Cerrada" additionally reveals a single CLP field
 * (optional) that saves on Enter or blur — the status itself is already saved.
 */
export function OutcomeSelector({
  outcome,
  onSelect,
  onValue,
}: {
  outcome: Outcome | null;
  onSelect: (status: OutcomeStatus) => void;
  onValue: (valueClp: number | null) => void;
}) {
  const [showValue, setShowValue] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(outcome?.value_clp != null ? String(outcome.value_clp) : "");
    if (outcome?.status !== "closed") setShowValue(false);
  }, [outcome?.conversation_id, outcome?.status, outcome?.value_clp]);

  useEffect(() => {
    if (showValue) inputRef.current?.focus();
  }, [showValue]);

  const commit = () => {
    const raw = draft.replace(/[^\d]/g, "");
    onValue(raw ? Number(raw) : null);
    setShowValue(false);
  };

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-1">
        {OUTCOME_STATES.map((s) => {
          const active = outcome?.status === s.key;
          return (
            <button
              key={s.key}
              type="button"
              title={s.label}
              aria-pressed={active}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s.key);
                if (s.key === "closed") setShowValue(true);
                else setShowValue(false);
              }}
              className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] font-medium leading-none transition ${
                active
                  ? ACTIVE[s.key]
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.short}
            </button>
          );
        })}
      </div>

      {outcome?.status === "closed" && (showValue || outcome.value_clp != null) && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">CLP</span>
          <input
            ref={inputRef}
            value={draft}
            inputMode="numeric"
            placeholder="Valor del cierre"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setShowValue(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-6 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}

export function formatClp(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}
