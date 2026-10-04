import { useDraggable } from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { Ban, ExternalLink, GripVertical, UserPlus } from "lucide-react";
import { StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { findPlan } from "@/lib/pricing/plans";
import {
  COLD_STATE,
  PROSPECT_STATES,
  RESUME_STATES,
  STATE_META,
  convertedClientId,
  isProspectState,
  noContactUntil,
  type ProspectState,
} from "@/lib/prospects/schema";
import { formatShortDate, toDateInput } from "./format";
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

/** "Abrir cliente" si ya se convirtió; "Convertir" si está ganado; nada en otro caso. */
export function ConvertAction({ prospect, onConvert, label = "Convertir" }: {
  prospect: Prospect;
  onConvert: CardActions["onConvert"];
  label?: string;
}) {
  const clientId = convertedClientId(prospect);
  if (clientId) {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs">
        <Link to="/clients/$clientId" params={{ clientId }}>
          <ExternalLink aria-hidden className="mr-1 h-3.5 w-3.5" /> Abrir cliente
        </Link>
      </Button>
    );
  }
  if (prospect.estado !== "ganado") return null;
  return (
    <Button size="sm" variant="outline" className="h-8 shrink-0 px-2 text-xs" onClick={() => onConvert(prospect)}>
      <UserPlus aria-hidden className="mr-1 h-3.5 w-3.5" /> {label}
    </Button>
  );
}

/** "Retomar" un prospecto frío: a Nuevo o Contactado (retomar es siempre manual). */
export function ResumeAction({ prospect, onMove }: { prospect: Prospect; onMove: CardActions["onMove"] }) {
  if (prospect.estado !== COLD_STATE) return null;
  return (
    <select
      aria-label={`Retomar ${prospect.nombre}`}
      value=""
      onChange={(e) => {
        const next = e.target.value;
        if ((RESUME_STATES as readonly string[]).includes(next)) onMove(prospect, next as ProspectState);
      }}
      className={cn(
        "h-8 shrink-0 rounded-app-sm border border-border-subtle bg-surface px-2 text-xs text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <option value="" disabled>
        Retomar…
      </option>
      {RESUME_STATES.map((s) => (
        <option key={s} value={s}>
          {STATE_META[s].label}
        </option>
      ))}
    </select>
  );
}

/** Aviso "No contactar hasta …" (perdido con plazo vigente o baja). Los fríos no tienen plazo. */
export function NoContactBadge({ prospect }: { prospect: Prospect }) {
  if (prospect.estado === "baja") return <StatusBadge status="baja" label="No contactar" tone="danger" />;
  if (prospect.estado === COLD_STATE) return null;
  const today = toDateInput(new Date().toISOString());
  // prospects.no_contactar_hasta (v3) o, en prospectos antiguos, la nota "No contactar antes de …".
  const column = prospect.no_contactar_hasta && prospect.no_contactar_hasta > today ? prospect.no_contactar_hasta : null;
  const until = column ?? noContactUntil(prospect.notas, today);
  if (!until) return null;
  return <StatusBadge status="no-contactar" label={`No contactar hasta ${formatShortDate(`${until}T12:00:00`)}`} tone="warning" />;
}

export function CardBody({ prospect }: { prospect: Prospect }) {
  const plan = findPlan(prospect.producto_sugerido);
  const meta = [prospect.rubro, prospect.comuna].filter(Boolean).join(" · ");
  return (
    <>
      <p className="truncate text-sm font-semibold text-foreground">{prospect.nombre}</p>
      {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <NoContactBadge prospect={prospect} />
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
        <ConvertAction prospect={prospect} onConvert={actions.onConvert} />
        <ResumeAction prospect={prospect} onMove={actions.onMove} />
      </div>
    </li>
  );
}
