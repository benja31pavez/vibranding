import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Upload, Lock, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { captureInstagramGridVersion } from "@/lib/meta/igSync.functions";
import {
  createManualVersion, formatCaptured, monthLabel, updateVersionMeta, type GridVersion,
} from "@/lib/instagram/gridVersions";

export function GridVersionBar({
  clientId,
  versions,
  selectedId,
  onSelect,
  onChanged,
  editable,
}: {
  clientId: string;
  versions: GridVersion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: (selectId?: string) => void;
  editable: boolean;
}) {
  const capture = useServerFn(captureInstagramGridVersion);
  const [busy, setBusy] = useState<"capture" | "manual" | "meta" | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLabel, setManualLabel] = useState(monthLabel());
  const [metaOpen, setMetaOpen] = useState(false);
  const selected = versions.find((v) => v.id === selectedId) ?? null;
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const doCapture = async () => {
    setBusy("capture");
    try {
      const res = await capture({ data: { clientId, label: monthLabel() } });
      if (!res.ok) {
        if (res.empty) toast.info(res.reason);
        else toast.error(res.reason);
        return;
      }
      toast.success(`Versión "${res.label}" creada con ${res.mediaCount} publicaciones`);
      onChanged(res.versionId);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo capturar el estado actual");
    } finally {
      setBusy(null);
    }
  };

  const doManual = async () => {
    setBusy("manual");
    try {
      const v = await createManualVersion(clientId, manualLabel);
      toast.success(`Versión "${v.label}" creada. Sube las publicaciones.`);
      setManualOpen(false);
      onChanged(v.id);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la versión");
    } finally {
      setBusy(null);
    }
  };

  const saveMeta = async () => {
    if (!selected) return;
    setBusy("meta");
    try {
      await updateVersionMeta(selected.id, { label, notes: notes.trim() || null });
      toast.success("Versión actualizada");
      setMetaOpen(false);
      onChanged(selected.id);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-surface px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        {editable ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs font-medium text-accent">Versión en curso</span>
              </TooltipTrigger>
              <TooltipContent>
                Es la versión manual más reciente: puedes subir publicaciones aquí. La
              sincronización con Instagram no las modifica.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Registro histórico: refleja cómo estaba la cuenta en esa fecha y no se puede editar.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Select value={selectedId ?? undefined} onValueChange={onSelect}>
          <SelectTrigger className="h-9 w-[280px] text-sm">
            <SelectValue placeholder="Sin versiones" />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label} · {formatCaptured(v.captured_at)}
                {v.is_baseline ? " · Estado inicial" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLabel(selected.label);
              setNotes(selected.notes ?? "");
              setMetaOpen(true);
            }}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Etiqueta y notas
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button size="sm" variant="outline" onClick={doCapture} disabled={busy !== null}>
          {busy === "capture" ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5 mr-1.5" />
          )}
          {busy === "capture" ? "Capturando…" : "Capturar estado actual"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setManualLabel(monthLabel());
            setManualOpen(true);
          }}
          disabled={busy !== null}
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Subir manualmente
        </Button>
      </div>

      {selected?.notes && (
        <p className="w-full text-xs text-muted-foreground whitespace-pre-wrap">{selected.notes}</p>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva versión manual</DialogTitle>
            <DialogDescription>
              Para cuentas sin conexión a Meta. Podrás subir las publicaciones de esta versión;
              al crear la siguiente, esta queda como registro histórico. La sincronización con
              Instagram no toca estas publicaciones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Etiqueta</Label>
            <Input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={doManual} disabled={busy === "manual"}>
              {busy === "manual" ? "Creando…" : "Crear versión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar versión</DialogTitle>
            <DialogDescription>
              Puedes cambiar la etiqueta y las notas. El contenido de la versión no se modifica.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Etiqueta</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)}>Cancelar</Button>
            <Button onClick={saveMeta} disabled={busy === "meta"}>
              {busy === "meta" ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
