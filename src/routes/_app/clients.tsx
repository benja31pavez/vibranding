import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Instagram, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsList,
});

interface Client {
  id: string;
  name: string;
  instagram_handle: string | null;
  notes: string | null;
  updated_at: string;
}

function ClientsList() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,instagram_handle,notes,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("clients").insert({
      name: name.trim(),
      instagram_handle: handle.trim() || null,
      user_id: user!.id,
    });
    if (error) return toast.error(error.message);
    setName(""); setHandle(""); setOpen(false);
    toast.success("Cliente creado");
    load();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gestiona las asesorías de cada uno.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full h-11 px-5"><Plus className="w-4 h-4 mr-1" /> Nuevo cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Instagram (sin @)</Label>
                <Input value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))} placeholder="usuario" />
              </div>
              <DialogFooter>
                <Button type="submit" className="rounded-full">Crear</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="text-muted-foreground">Cargando…</div>
      ) : clients.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-16 text-center bg-surface">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-secondary grid place-items-center mb-4">
            <Instagram className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium">Aún no tienes clientes</h3>
          <p className="text-muted-foreground mt-1">Crea tu primer cliente para empezar.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Link
              key={c.id}
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="group rounded-2xl border bg-surface p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  {c.instagram_handle && (
                    <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Instagram className="w-3.5 h-3.5" /> @{c.instagram_handle}
                    </div>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
