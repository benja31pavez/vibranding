import { useState } from "react";
import { FolderOpen, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { StageSummary } from "@/lib/delivery/planStages";
import { TEAM } from "@/lib/delivery/team";
import type { StageDueTarget } from "./planQueries";

export interface StageMenuActions {
  canEdit: boolean;
  onSetDue: (stage: StageDueTarget, dueDate: string | null) => Promise<boolean>;
  /** Abre la lista completa de entregables (estado, checklist, archivos y revisión). */
  onOpenDeliverables: () => void;
}

export interface StageMenuProps extends StageMenuActions {
  /** Etapas que se editan desde este menú (una por tarjeta de etapa; varias por persona). */
  stages: readonly StageSummary[];
  /** Nombre accesible del botón "⋯". */
  label: string;
  className?: string;
}

/** Botón "⋯" de una tarjeta de etapa: fecha de entrega y acceso a los entregables. */
export function StageMenu({
  stages,
  label,
  className,
  canEdit,
  onSetDue,
  onOpenDeliverables,
}: StageMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <ul className="space-y-3">
          {stages.map((stage) => (
            <StageDueRow key={stage.key} stage={stage} canEdit={canEdit} onSetDue={onSetDue} />
          ))}
        </ul>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full justify-start text-xs"
          onClick={() => {
            setOpen(false);
            onOpenDeliverables();
          }}
        >
          <FolderOpen aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Entregables, archivos y revisión
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function StageDueRow({
  stage,
  canEdit,
  onSetDue,
}: {
  stage: StageSummary;
  canEdit: boolean;
  onSetDue: StageMenuActions["onSetDue"];
}) {
  const [saving, setSaving] = useState(false);
  const owner = TEAM[stage.owner];
  // Solo la fecha propia de la etapa se edita; la deducida de sus tareas se muestra como sugerencia.
  const value = stage.rowId ? (stage.dueDate ?? "") : "";
  const inputId = `stage-due-${stage.key}`;
  const save = async (next: string | null) => {
    setSaving(true);
    await onSetDue({ key: stage.key, label: stage.label, rowId: stage.rowId }, next);
    setSaving(false);
  };
  return (
    <li className="space-y-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{stage.label}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          Responsable: {owner.name} · {owner.role}
        </p>
      </div>
      <label htmlFor={inputId} className="block text-[11px] font-medium text-muted-foreground">
        Fecha de entrega
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={inputId}
          type="date"
          value={value}
          disabled={!canEdit || saving}
          onChange={(e) => {
            const next = e.target.value || null;
            if (next !== (value || null)) void save(next);
          }}
          className="h-8 text-xs"
        />
        {value && canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 px-2 text-xs"
            disabled={saving}
            onClick={() => void save(null)}
          >
            Quitar
          </Button>
        )}
      </div>
      {!stage.rowId && stage.dueDate && (
        <p className="text-[11px] text-muted-foreground">
          Sin fecha propia; se muestra la última de sus tareas.
        </p>
      )}
      {!canEdit && (
        <p className="text-[11px] text-muted-foreground">
          No tienes permisos para editar este cliente.
        </p>
      )}
    </li>
  );
}
