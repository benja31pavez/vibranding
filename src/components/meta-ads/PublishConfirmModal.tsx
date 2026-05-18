import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { CampaignDraft, AdsetDraft, AdDraft } from "@/lib/meta-ads/schemas";
import { OBJECTIVES, CTAS } from "@/lib/meta-ads/constants";

export function PublishConfirmModal({
  open, onOpenChange, campaign, adset, ad, publishing, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: CampaignDraft;
  adset: AdsetDraft;
  ad: AdDraft;
  publishing: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Confirmar publicación en Meta</DialogTitle>
          <DialogDescription>Revisa la campaña antes de enviarla al Administrador de anuncios.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <h4 className="font-semibold mb-1">Campaña</h4>
            <ul className="text-xs space-y-0.5 text-muted-foreground">
              <li><b>{campaign.name}</b></li>
              <li>Objetivo: {OBJECTIVES[campaign.objective]}</li>
              <li>Estado: {campaign.status} · Estrategia: {campaign.bidStrategy}</li>
              <li>CBO: {campaign.cboEnabled ? `Sí (${campaign.budgetType} ${campaign.budgetAmount})` : "No"}</li>
              <li>Inicio: {campaign.startTime}{campaign.endTime ? ` · Fin: ${campaign.endTime}` : ""}</li>
              {campaign.spendCap ? <li>Tope: {campaign.spendCap}</li> : null}
            </ul>
          </section>
          <section>
            <h4 className="font-semibold mb-1">Conjunto</h4>
            <ul className="text-xs space-y-0.5 text-muted-foreground">
              <li><b>{adset.name}</b> · {adset.status}</li>
              <li>Optimización: {adset.optimizationGoal} · Facturación: {adset.billingEvent}</li>
              {!campaign.cboEnabled && adset.budgetType !== "inherit" && (
                <li>Presupuesto: {adset.budgetType} {adset.budgetAmount}</li>
              )}
              <li>Países: {adset.countries.join(", ")}</li>
              <li>Edad: {adset.ageMin}–{adset.ageMax} · Género: {adset.gender}</li>
              <li>Ubicaciones: {adset.placementMode === "automatic" ? "Automáticas" : adset.placements.join(", ")}</li>
              {adset.interests.length > 0 && <li>Intereses: {adset.interests.join(", ")}</li>}
            </ul>
          </section>
          <section>
            <h4 className="font-semibold mb-1">Anuncio</h4>
            <ul className="text-xs space-y-0.5 text-muted-foreground">
              <li><b>{ad.name}</b> · {ad.status} · Formato: {ad.format}</li>
              <li>Página: {ad.pageId}{ad.instagramActorId ? ` · IG: ${ad.instagramActorId}` : ""}</li>
              <li>CTA: {CTAS[ad.cta as keyof typeof CTAS] ?? ad.cta}</li>
              <li>URL: {ad.linkUrl}</li>
              {ad.format === "carousel" && <li>Tarjetas: {ad.carouselCards.length}</li>}
            </ul>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={publishing}>
            {publishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Publicar en Meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
