import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Result = { ok: true } | { ok: false; error: string };

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  handle: string | null;
  onSubmit: (name: string, handle: string) => Promise<Result>;
}

export function RenameClientDialog({ open, onOpenChange, name, handle, onSubmit }: RenameDialogProps) {
  const [draftName, setDraftName] = useState(name);
  const [draftHandle, setDraftHandle] = useState(handle ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftName(name);
      setDraftHandle(handle ?? "");
    }
  }, [open, name, handle]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await onSubmit(draftName, draftHandle);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cliente actualizado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Renombrar cliente</DialogTitle>
            <DialogDescription>Cambia el nombre visible y el usuario de Instagram.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-name">Nombre</Label>
            <Input id="rename-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rename-handle">Instagram</Label>
            <Input
              id="rename-handle"
              value={draftHandle}
              onChange={(e) => setDraftHandle(e.target.value)}
              placeholder="@usuario"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !draftName.trim()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onConfirm: () => Promise<Result>;
}

/** Confirmación fuerte: hay que escribir el nombre exacto del cliente. */
export function DeleteClientDialog({ open, onOpenChange, name, onConfirm }: DeleteDialogProps) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const matches = typed.trim() === name.trim();

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    setDeleting(true);
    const res = await onConfirm();
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cliente eliminado");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={confirm} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán su contenido, etapas, pagos y accesos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              Escribe <span className="font-semibold text-foreground">{name}</span> para confirmar
            </Label>
            <Input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!matches || deleting}>
              {deleting ? "Eliminando…" : "Eliminar cliente"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
