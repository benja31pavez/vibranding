import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { invalidateShellClients } from "@/components/shell/shellQueries";
import { invalidateClientHealth } from "@/components/clients/health";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchLogoAfterHandleChange, invalidateClientLogos } from "@/components/clients/logo";
import { invalidateClientsList } from "./clientsListData";

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Botón "Nuevo cliente" + diálogo de creación. */
export function NewClientDialog({ open, onOpenChange }: NewClientDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    const { data: orgId, error: orgError } = await supabase.rpc("ensure_org");
    if (orgError || !orgId)
      return toast.error(orgError?.message ?? "No se pudo obtener la organización");
    const cleanHandle = handle.trim().replace(/^@+/, "") || null;
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        name: name.trim(),
        instagram_handle: cleanHandle,
        user_id: user.id,
        org_id: orgId as string,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setName("");
    setHandle("");
    onOpenChange(false);
    toast.success("Cliente creado");
    void invalidateClientsList(queryClient);
    void invalidateShellClients(queryClient);
    void invalidateClientHealth(queryClient);
    if (cleanHandle && created) {
      void fetchLogoAfterHandleChange(created.id, () => invalidateClientLogos(queryClient));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden className="mr-1 h-4 w-4" /> Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-client-name">Nombre</Label>
            <Input
              id="new-client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-client-handle">Instagram (sin @)</Label>
            <Input
              id="new-client-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              placeholder="usuario"
            />
          </div>
          <DialogFooter>
            <Button type="submit">Crear</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
