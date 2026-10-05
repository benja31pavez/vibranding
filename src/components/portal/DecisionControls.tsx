import { useState } from "react";
import { Check, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/app";
import { NOTE_MAX_LENGTH, NOTE_MIN_LENGTH, type PortalDecision } from "@/lib/portal/model";

interface DecisionControlsProps {
  /** Nombre del ítem para los diálogos ("el post del 5 oct", "Logo final"). */
  itemLabel: string;
  readOnly: boolean;
  busy: boolean;
  onDecide: (decision: PortalDecision, note: string) => void;
}

/** Botones Aprobar / Pedir cambios con confirmación y nota obligatoria para cambios. */
export function DecisionControls({ itemLabel, readOnly, busy, onDecide }: DecisionControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-11"
          disabled={readOnly || busy}
          onClick={() => setChangesOpen(true)}
        >
          <MessageSquareText aria-hidden className="mr-1.5 h-4 w-4" /> Pedir cambios
        </Button>
        <Button className="h-11" disabled={readOnly || busy} onClick={() => setConfirmOpen(true)}>
          <Check aria-hidden className="mr-1.5 h-4 w-4" /> Aprobar
        </Button>
      </div>
      {readOnly && (
        <p className="text-center text-xs text-muted-foreground">
          Vista previa: el cliente verá estos botones activos.
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Lo apruebas?"
        description={`Le avisaremos a tu equipo que ${itemLabel} está aprobado.`}
        confirmLabel="Sí, aprobar"
        onConfirm={() => onDecide("approve", "")}
      />
      <ChangesDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        itemLabel={itemLabel}
        onSubmit={(note) => onDecide("changes", note)}
      />
    </div>
  );
}

function ChangesDialog({
  open,
  onOpenChange,
  itemLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const tooShort = note.trim().length < NOTE_MIN_LENGTH;

  const submit = () => {
    if (tooShort) return;
    onSubmit(note.trim());
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Qué te gustaría cambiar?</DialogTitle>
          <DialogDescription>
            Cuéntanos con tus palabras qué ajustar en {itemLabel}. Tu equipo lo recibe al tiro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="portal-change-note">Tus comentarios</Label>
          <Textarea
            id="portal-change-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
            rows={5}
            placeholder="Ej.: me gustaría el texto más corto y usar la foto del local."
            autoFocus
          />
          <p className="text-right text-xs tabular-nums text-muted-foreground">
            {note.length}/{NOTE_MAX_LENGTH}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={tooShort}>
            Enviar comentarios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
