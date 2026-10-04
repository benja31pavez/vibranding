import { useDraggable } from "@dnd-kit/core";
import { Ban, GripVertical, UserPlus } from "lucide-react";
import { StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { findPlan } from "@/lib/pricing/plans";
import { PROSPECT_STATES, STATE_META, isProspectState, type ProspectState } from "@/lib/prospects/schema";
import { formatShortDate } from "./format";
import { cn } from "@/lib/utils";
import type { Prospect } from "./prospectsData";

export interface CardActions {
  onOpen: (p: Prospect) => void;
  onMove: (p: Prospect, estado: ProspectState) => void;
  onConvert: (p: Prospect) => void;
}

/** Select nativo para cambiar de estado (alternativa accesible al arrastre). */
export function StageSelect({
  prospect,
  onMove,
  className,
}: {
  prospect: Prospect;
  onMove: CardActions["onMove"];
  className?: string;
}) {
  return (
    <select
      aria-label={`Mover ${prospect.nombre} a otro estado`}
      value={prospect.estado}
      onChange={(e) => {
        const next = e.target.value;
        if (isProspectState(next) && next !== prospect.estado) onMove(prospect, next);
      }}
      className={cn(
        "h-8 rounded-app-sm border border-border-subtle bg-surface px-2 text-xs text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {PROSPECT_STATES.map((s) => (
        <option key={s} value={s}>
          {STATE_META[s].label}
        </option>
      ))}
    </select>
  );
}

export function CardBody({ prospect }: { prospect: Prospect }) {
  const plan = findPlan(prospect.producto_sugerido);
  const meta = [prospect.rubro, prospect.comuna].filter(Boolean).join(" · ");
  return (
    <>
      <p className="truncate text-sm font-semibold text-foreground">{prospect.nombre}</p>
      {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {prospect.estado === "baja" && (
          <StatusBadge status="baja" label="No contactar" tone="danger" />
        )}
        {plan && <StatusBadge status={plan.key} label={plan.label} tone="info" />}
        <span className="text-xs tabular-nums text-muted-foreground">
          Últ. contacto: {formatShortDate(prospect.ultimo_contacto)}
        </span>
      </div>
    </>
  );
}

export function ProspectCard({ prospect, actions }: { prospect: Prospect; actions: CardActions }) {
  const isBaja = prospect.estado === "baja";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: prospect.id, disabled: isBaja });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "rounded-app-md border border-border-subtle bg-surface p-3 shadow-app-xs",
        isDragging && "opacity-40",
        isBaja && "border-danger/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Arrastrar ${prospect.nombre}`}
          aria-roledescription="tarjeta arrastrable"
          disabled={isBaja}
          className="mt-0.5 shrink-0 cursor-grab rounded-app-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isBaja ? <Ban aria-hidden className="h-4 w-4" /> : <GripVertical aria-hidden className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => actions.onOpen(prospect)}
          className="min-w-0 flex-1 rounded-app-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardBody prospect={prospect} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <StageSelect prospect={prospect} onMove={actions.onMove} className="min-w-0 flex-1" />
        {prospect.estado === "ganado" && (
          <Button size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs" onClick={() => actions.onConvert(prospect)}>
            <UserPlus aria-hidden className="mr-1 h-3.5 w-3.5" /> Convertir
          </Button>
        )}
      </div>
    </li>
  );
}
