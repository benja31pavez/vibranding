import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Trash2, Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TaskList } from "@/components/TaskList";
import { IdentityEditor, ConfigEditor, PostsEditor, HighlightsEditor, type IGProfile, type IGPost, type IGHighlight } from "@/components/InstagramEditor";
import { IphonePreview } from "@/components/IphonePreview";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SummaryExport } from "@/components/SummaryExport";
import { exportElementToPdf } from "@/lib/exportPdf";
import { PricingSummary, ProposedCostsBreakdown, loadPricing, type PricingSettings } from "@/components/PricingPanel";
import { useAuth } from "@/hooks/use-auth";
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
  const [highlights, setHighlights] = useState<IGHighlight[]>([]);
  const [view, setView] = useState<"current" | "proposed">("proposed");
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [pricing, setPricing] = useState<PricingSettings | null>(null);

  useEffect(() => {
    if (user) loadPricing(user.id).then(setPricing);
  }, [user]);

  const loadClient = async () => {
    const { data } = await supabase.from("clients").select("id,name,instagram_handle").eq("id", clientId).maybeSingle();
    setClient(data);
  };
  const loadIG = async () => {
    const [{ data: pr }, { data: ps }, { data: hi }] = await Promise.all([
      supabase.from("instagram_profiles").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("instagram_posts").select("*").eq("client_id", clientId),
      supabase.from("instagram_highlights").select("*").eq("client_id", clientId),
    ]);
    setProfile(pr as IGProfile | null);
    setPosts((ps ?? []) as IGPost[]);
    setHighlights((hi ?? []) as IGHighlight[]);
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

  const handleExportPdf = async () => {
    if (!profile || !client) return;
    setExporting(true);
    try {
      // Wait a frame so the off-screen export is mounted
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 80));
      if (!exportRef.current) throw new Error("export node missing");
      await exportElementToPdf(exportRef.current, `resumen-${client.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      toast.success("PDF generado");
    } catch (e: any) {
      toast.error(e.message ?? "Error al generar PDF");
    } finally {
      setExporting(false);
    }
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting || !profile}>
            <FileDown className="w-4 h-4 mr-1" /> {exporting ? "Generando…" : "Exportar PDF"}
          </Button>
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
        </div>
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
              <SummarySection clientId={clientId} pricing={pricing} posts={posts} />
            </TabsContent>

            <TabsContent value="objectives" className="mt-6">
              <TaskList clientId={clientId} table="objectives" title="Objetivos" emptyHint="Aún no hay objetivos." />
            </TabsContent>

            <TabsContent value="deliverables" className="mt-6">
              <TaskList clientId={clientId} table="deliverables" title="Entregables" emptyHint="Aún no hay entregables." />
            </TabsContent>

            <TabsContent value="instagram" className="mt-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                Editando vista <strong className={view === "proposed" ? "text-accent" : ""}>{view === "proposed" ? "Propuesta" : "Actual"}</strong>. Cambia con el selector del iPhone.
              </p>
              {profile && (
                <Accordion type="single" collapsible defaultValue="identity" className="w-full space-y-2">
                  <AccordionItem value="identity" className="border rounded-xl bg-surface px-4">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">Identidad</AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <IdentityEditor profile={profile} setProfile={setProfile} clientId={clientId} side={view} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="config" className="border rounded-xl bg-surface px-4">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">Configuración</AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <ConfigEditor profile={profile} setProfile={setProfile} side={view} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="highlights" className="border rounded-xl bg-surface px-4">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">
                      Historias destacadas {view === "proposed" ? "propuestas" : "actuales"}
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <HighlightsEditor clientId={clientId} highlights={highlights} setHighlights={setHighlights} type={view} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="posts" className="border rounded-xl bg-surface px-4">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">
                      Posts {view === "proposed" ? "propuestos" : "actuales"}
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <PostsEditor clientId={clientId} posts={posts} setPosts={setPosts} type={view} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
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
          {profile && <IphonePreview profile={profile} posts={posts} highlights={highlights} view={view} />}
        </div>
      </div>

      {/* Off-screen export node */}
      {profile && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            left: "-10000px",
            width: 900,
            pointerEvents: "none",
            opacity: exporting ? 1 : 0,
          }}
        >
          <div ref={exportRef}>
            <SummaryExport client={client} profile={profile} posts={posts} highlights={highlights} pricing={pricing} />
          </div>
        </div>
      )}
    </div>
  );
}

function SummarySection({ clientId, pricing, posts }: { clientId: string; pricing: PricingSettings | null; posts: import("@/components/InstagramEditor").IGPost[] }) {
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
          Usa <strong>Exportar PDF</strong> para enviar este resumen a tu cliente.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Objetivos" value={`${counts.objDone}/${counts.obj}`} hint="completados" />
        <Stat label="Entregables" value={`${counts.delDone}/${counts.del}`} hint="completados" />
        <Stat label="Cobrado" value={`$${counts.paid.toFixed(0)}`} hint={`Pendiente $${counts.pending.toFixed(0)}`} />
      </div>
      <ProposedCostsBreakdown pricing={pricing} posts={posts} />
      <PricingSummary pricing={pricing} />
    </div>
  );
}
