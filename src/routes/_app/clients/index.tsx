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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/app";

export const Route = createFileRoute("/_app/clients/")({
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,instagram_handle,notes,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[clients] error al cargar", error);
      setLoadError(error.message);
    }
    setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: orgId, error: orgError } = await supabase.rpc("ensure_org");
    if (orgError || !orgId) return toast.error(orgError?.message ?? "No se pudo obtener la organización");
    const { error } = await supabase.from("clients").insert({
      name: name.trim(),
      instagram_handle: handle.trim() || null,
      user_id: user!.id,
      org_id: orgId as string,
    });
    if (error) return toast.error(error.message);
    setName(""); setHandle(""); setOpen(false);
    toast.success("Cliente creado");
    load();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 md:px-10">
      <PageHeader
        title="Clientes"
        description="Gestiona las asesorías de cada uno."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/clients/connect">Conectar con Meta</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus aria-hidden className="mr-1 h-4 w-4" /> Nuevo cliente</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-client-name">Nombre</Label>
                    <Input id="new-client-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-client-handle">Instagram (sin @)</Label>
                    <Input id="new-client-handle" value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))} placeholder="usuario" />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Crear</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Instagram}
          title="Aún no tienes clientes"
          description="Crea tu primer cliente para empezar."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link
              key={c.id}
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="group rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs transition-shadow hover:border-border-strong hover:shadow-app-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{c.name}</h3>
                  {c.instagram_handle && (
                    <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                      <Instagram aria-hidden className="h-3.5 w-3.5" /> @{c.instagram_handle}
                    </div>
                  )}
                </div>
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const SKELETON_CARDS = 6;

function CardsSkeleton() {
  return (
    <div role="status" aria-busy className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Cargando clientes</span>
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <div key={i} className="space-y-2 rounded-app-lg border border-border-subtle bg-surface p-5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
