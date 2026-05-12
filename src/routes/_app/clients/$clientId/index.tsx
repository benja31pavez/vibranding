import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useAuth } from "@/hooks/use-auth";
import { PricingSummary, ProposedCostsBreakdown, loadPricing, type PricingSettings } from "@/components/PricingPanel";

export const Route = createFileRoute("/_app/clients/$clientId/")({
  component: SummaryPage,
});

function SummaryPage() {
  const { clientId } = Route.useParams();
  const { ig } = useActiveClient();
  const { user } = useAuth();
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [counts, setCounts] = useState({ obj: 0, objDone: 0, del: 0, delDone: 0, paid: 0, pending: 0 });

  useEffect(() => {
    if (user) loadPricing(user.id).then(setPricing);
  }, [user]);

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

  const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
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
          Todo en un vistazo. Usa <strong>Exportar PDF</strong> para enviar este resumen a tu cliente.
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Objetivos" value={`${counts.objDone}/${counts.obj}`} hint="completados" />
        <Stat label="Entregables" value={`${counts.delDone}/${counts.del}`} hint="completados" />
        <Stat label="Cobrado" value={`$${counts.paid.toFixed(0)}`} hint={`Pendiente $${counts.pending.toFixed(0)}`} />
      </div>
      <ProposedCostsBreakdown pricing={pricing} posts={ig.posts} />
      <PricingSummary pricing={pricing} />
    </div>
  );
}
