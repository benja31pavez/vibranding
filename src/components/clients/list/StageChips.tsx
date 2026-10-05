import type { ClientStatus } from "@/components/clients/ficha/fichaQueries";
import { cn } from "@/lib/utils";
import type { StageFilter } from "./clientsListData";

/** Orden de los chips (lo más relevante primero). */
const STAGE_ORDER: readonly ClientStatus[] = [
  "activo",
  "onboarding",
  "pausado",
  "terminado",
  "prospecto",
];
/** Etapas con chip siempre visible; "prospecto" solo aparece si hay alguno. */
const ALWAYS_SHOWN = new Set<ClientStatus>(["activo", "onboarding", "pausado", "terminado"]);

const PLURAL: Readonly<Record<StageFilter, string>> = {
  all: "Todos",
  prospecto: "Prospectos",
  onboarding: "Onboarding",
  activo: "Activos",
  pausado: "Pausados",
  terminado: "Terminados",
};

interface StageChipsProps {
  value: StageFilter;
  onChange: (stage: StageFilter) => void;
  total: number;
  counts: Readonly<Record<ClientStatus, number>>;
}

/** Cartera por etapa de un vistazo: cada chip filtra y muestra cuántos hay. */
export function StageChips({ value, onChange, total, counts }: StageChipsProps) {
  const stages: StageFilter[] = [
    "all",
    ...STAGE_ORDER.filter((s) => ALWAYS_SHOWN.has(s) || counts[s] > 0),
  ];
  return (
    <div
      role="group"
      aria-label="Filtrar por etapa"
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-app-md border border-border-subtle bg-surface-2 p-0.5"
    >
      {stages.map((stage) => {
        const count = stage === "all" ? total : counts[stage];
        const selected = value === stage;
        return (
          <button
            key={stage}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(stage)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-app-sm px-2.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-surface text-foreground shadow-app-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PLURAL[stage]}
            <span
              className={cn(
                "text-xs tabular-nums",
                selected ? "text-muted-foreground" : "text-muted-foreground/80",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
