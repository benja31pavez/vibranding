import { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SummaryExport } from "@/components/SummaryExport";
import { exportElementToPdf } from "@/lib/exportPdf";
import { loadPricing, type PricingSettings } from "@/components/PricingPanel";
import { useAuth } from "@/hooks/use-auth";
import { useActiveClient } from "@/contexts/ActiveClientContext";

const RENDER_SETTLE_MS = 80;

/** Botón "Exportar PDF" + nodo fuera de pantalla con el resumen (requiere datos de Instagram). */
export function ExportPdfButton() {
  const { client, ig } = useActiveClient();
  const { user } = useAuth();
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadPricing(user.id)
      .then(setPricing)
      .catch(() => setPricing(null));
  }, [user]);

  const handleExportPdf = async () => {
    if (!ig.profile || !client) return;
    setExporting(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, RENDER_SETTLE_MS));
      if (!exportRef.current) throw new Error("No se encontró el resumen para exportar");
      const slug = client.name.replace(/\s+/g, "-").toLowerCase();
      await exportElementToPdf(exportRef.current, `resumen-${slug}.pdf`);
      toast.success("PDF generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar PDF");
    } finally {
      setExporting(false);
    }
  };

  const disabled = !ig.profile || exporting;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExportPdf}
        disabled={disabled}
        title={ig.profile ? undefined : "Conecta o sincroniza Instagram para exportar el resumen"}
      >
        <FileDown aria-hidden className="mr-1.5 h-4 w-4" />
        {exporting ? "Generando…" : "Exportar PDF"}
      </Button>

      {ig.profile && client && (
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
            <SummaryExport
              client={client}
              profile={ig.profile}
              posts={ig.posts}
              highlights={ig.highlights}
              pricing={pricing}
            />
          </div>
        </div>
      )}
    </>
  );
}
