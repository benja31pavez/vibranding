import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Trash2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SummaryExport } from "@/components/SummaryExport";
import { exportElementToPdf } from "@/lib/exportPdf";
import { loadPricing, type PricingSettings } from "@/components/PricingPanel";
import { useAuth } from "@/hooks/use-auth";
import { ClientProvider, useActiveClient } from "@/contexts/ActiveClientContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/clients/$clientId")({
  component: ClientLayout,
});

function ClientLayout() {
  const { clientId } = Route.useParams();
  return (
    <ClientProvider clientId={clientId}>
      <ClientShell />
    </ClientProvider>
  );
}

function ClientShell() {
  const { clientId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { client, ig, reloadClient } = useActiveClient();
  const { user } = useAuth();
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadPricing(user.id).then(setPricing);
  }, [user]);

  const renameClient = async (name: string) => {
    if (!name.trim() || name === client?.name) return;
    await supabase.from("clients").update({ name: name.trim() }).eq("id", clientId);
    reloadClient();
  };

  const updateHandle = async (h: string) => {
    await supabase.from("clients").update({ instagram_handle: h.trim() || null }).eq("id", clientId);
    reloadClient();
  };

  const deleteClient = async () => {
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) return toast.error(error.message);
    toast.success("Cliente eliminado");
    localStorage.removeItem("activeClientId");
    navigate({ to: "/clients" });
  };

  const handleExportPdf = async () => {
    if (!ig.profile || !client) return;
    setExporting(true);
    try {
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

  if (!client) return <div className="p-10 text-muted-foreground">Cargando…</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
      <Outlet />

      {/* Off-screen export node — needs IG data */}
      {ig.profile && (
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
            <SummaryExport client={client} profile={ig.profile} posts={ig.posts} highlights={ig.highlights} pricing={pricing} />
          </div>
        </div>
      )}
    </div>
  );
}

