import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TaskList } from "@/components/TaskList";
import { ProfileEditor, PostsEditor, type IGProfile, type IGPost } from "@/components/InstagramEditor";
import { IphonePreview } from "@/components/IphonePreview";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/clients/$clientId")({
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = Route.useNavigate();
  const [client, setClient] = useState<{ id: string; name: string; instagram_handle: string | null } | null>(null);
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [view, setView] = useState<"current" | "proposed">("proposed");

  const loadClient = async () => {
    const { data } = await supabase.from("clients").select("id,name,instagram_handle").eq("id", clientId).maybeSingle();
    setClient(data);
  };
  const loadIG = async () => {
    const [{ data: pr }, { data: ps }] = await Promise.all([
      supabase.from("instagram_profiles").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("instagram_posts").select("*").eq("client_id", clientId),
    ]);
    setProfile(pr as IGProfile | null);
    setPosts((ps ?? []) as IGPost[]);
  };

  useEffect(() => {
    loadClient();
    loadIG();
  }, [clientId]);

  const renameClient = async (name: string) => {
    if (!name.trim() || name === client?.name) return;
    await supabase.from("clients").update({ name: name.trim() }).eq("id", clientId);
    loadClient();
  };

  const updateHandle = async (h: string) => {
    await supabase.from("clients").update({ instagram_handle: h.trim() || null }).eq("id", clientId);
    loadClient();
  };

  const deleteClient = async () => {
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) return toast.error(error.message);
    toast.success("Cliente eliminado");
    navigate({ to: "/clients" });
  };

  if (!client) {
    return <div className="p-10 text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" /> Clientes
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="space-y-2 min-w-0">
          <Input
            defaultValue={client.name}
            onBlur={(e) => renameClient(e.target.value)}
            className="text-3xl md:text-4xl font-semibold tracking-tight border-0 px-0 h-auto py-0 shadow-none focus-visible:ring-0 bg-transparent"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>@</span>
            <Input
              defaultValue={client.instagram_handle ?? ""}
              onBlur={(e) => updateHandle(e.target.value.replace(/^@/, ""))}
              placeholder="usuario"
              className="border-0 px-0 h-auto py-0 shadow-none focus-visible:ring-0 bg-transparent w-48"
            />
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground"><Trash2 className="w-4 h-4 mr-1" /> Eliminar cliente</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este cliente?</AlertDialogTitle>
              <AlertDialogDescription>Se borrarán objetivos, entregables, propuestas y pagos asociados.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={deleteClient}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-10">
        <div>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="rounded-full bg-secondary p-1 h-auto">
              <TabsTrigger value="summary" className="rounded-full px-4 py-1.5">Resumen</TabsTrigger>
              <TabsTrigger value="objectives" className="rounded-full px-4 py-1.5">Objetivos</TabsTrigger>
              <TabsTrigger value="deliverables" className="rounded-full px-4 py-1.5">Entregables</TabsTrigger>
              <TabsTrigger value="instagram" className="rounded-full px-4 py-1.5">Instagram</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-full px-4 py-1.5">Pagos</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-6 space-y-8">
              <SummarySection clientId={clientId} />
            </TabsContent>

            <TabsContent value="objectives" className="mt-6">
              <TaskList clientId={clientId} table="objectives" title="Objetivos" emptyHint="Aún no hay objetivos." />
            </TabsContent>

            <TabsContent value="deliverables" className="mt-6">
              <TaskList clientId={clientId} table="deliverables" title="Entregables" emptyHint="Aún no hay entregables." />
            </TabsContent>

            <TabsContent value="instagram" className="mt-6 space-y-8">
              {profile && <ProfileEditor profile={profile} onUpdate={loadIG} />}
              <div>
                <h3 className="text-lg font-semibold mb-3">Posts actuales</h3>
                <PostsEditor clientId={clientId} posts={posts} onUpdate={loadIG} type="current" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3 text-accent">Posts propuestos</h3>
                <PostsEditor clientId={clientId} posts={posts} onUpdate={loadIG} type="proposed" />
              </div>
            </TabsContent>

            <TabsContent value="payments" className="mt-6">
              <PaymentsPanel clientId={clientId} />
            </TabsContent>
          </Tabs>
        </div>

        {/* iPhone preview sidebar */}
        <div className="lg:sticky lg:top-8 lg:self-start space-y-3">
          <div className="flex justify-center gap-1 bg-secondary rounded-full p-1 max-w-[260px] mx-auto">
            <button
              onClick={() => setView("current")}
              className={`flex-1 text-xs py-1.5 px-3 rounded-full font-medium transition-colors ${view === "current" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}
            >
              Actual
            </button>
            <button
              onClick={() => setView("proposed")}
              className={`flex-1 text-xs py-1.5 px-3 rounded-full font-medium transition-colors ${view === "proposed" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}
            >
              Propuesta
            </button>
          </div>
          {profile && <IphonePreview profile={profile} posts={posts} view={view} />}
        </div>
      </div>
    </div>
  );
}

function SummarySection({ clientId }: { clientId: string }) {
  const [counts, setCounts] = useState({ obj: 0, objDone: 0, del: 0, delDone: 0, paid: 0, pending: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: d }, { data: p }] = await Promise.all([
        supabase.from("objectives").select("status").eq("client_id", clientId),
        supabase.from("deliverables").select("status").eq("client_id", clientId),
        supabase.from("payments").select("amount,status").eq("client_id", clientId),
      ]);
      const paid = (p ?? []).filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.amount), 0);
      const pending = (p ?? []).filter((x) => x.status !== "paid" && x.status !== "cancelled").reduce((s, x) => s + Number(x.amount), 0);
      setCounts({
        obj: o?.length ?? 0,
        objDone: (o ?? []).filter((x) => x.status === "done").length,
        del: d?.length ?? 0,
        delDone: (d ?? []).filter((x) => x.status === "done").length,
        paid, pending,
      });
    })();
  }, [clientId]);

  const Stat = ({ label, value, hint }: any) => (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Eye className="w-4 h-4" /> Vista rápida
        </div>
        <p className="text-muted-foreground text-sm max-w-prose">
          Todo en un vistazo. La maqueta de iPhone a la derecha muestra cómo se vería el perfil de Instagram con tu propuesta.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Objetivos" value={`${counts.objDone}/${counts.obj}`} hint="completados" />
        <Stat label="Entregables" value={`${counts.delDone}/${counts.del}`} hint="completados" />
        <Stat label="Cobrado" value={`$${counts.paid.toFixed(0)}`} hint={`Pendiente $${counts.pending.toFixed(0)}`} />
      </div>
    </div>
  );
}
