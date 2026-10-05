import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, ChevronRight, ChevronLeft, Save, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Step1Campaign } from "./Step1Campaign";
import { Step2AdSet } from "./Step2AdSet";
import { Step3Ad } from "./Step3Ad";
import { PublishConfirmModal } from "./PublishConfirmModal";
import {
  campaignSchema,
  adsetSchema,
  adSchema,
  safeValidate,
  type CampaignDraft,
  type AdsetDraft,
  type AdDraft,
} from "@/lib/meta-ads/schemas";
import { BUDGET_CONFIRMATION_REQUIRED } from "@/lib/meta/currency";
import { adsManagerUrl } from "@/lib/meta-ads/constants";
import { applyUtm } from "./UtmBuilder";

type PageOpt = { id: string; name: string };
type IgOpt = { id: string; username: string };

const blankCampaign = (): CampaignDraft => ({
  name: "",
  objective: "OUTCOME_TRAFFIC",
  status: "PAUSED",
  budgetType: "daily",
  budgetAmount: 5,
  startTime: new Date().toISOString().slice(0, 16),
  endTime: null,
  spendCap: null,
  cboEnabled: false,
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
});
const blankAdset = (): AdsetDraft => ({
  name: "Conjunto 1",
  status: "PAUSED",
  budgetType: "daily",
  budgetAmount: 5,
  startTime: null,
  endTime: null,
  optimizationGoal: "LINK_CLICKS",
  billingEvent: "IMPRESSIONS",
  bidAmount: null,
  countries: ["CL"],
  cities: "",
  ageMin: 18,
  ageMax: 65,
  gender: "all",
  languages: "",
  interests: [],
  behaviors: [],
  demographics: [],
  customAudiences: [],
  lookalikeAudiences: [],
  excludedAudiences: [],
  placementMode: "automatic",
  placements: [],
  devicePlatforms: [],
  userOs: [],
  wifiOnly: false,
});
const blankAd = (defaultPage: string, defaultIg: string | null): AdDraft => ({
  name: "Anuncio 1",
  status: "PAUSED",
  pageId: defaultPage,
  instagramActorId: defaultIg,
  format: "image",
  imageUrl: "",
  videoUrl: "",
  thumbnailUrl: "",
  carouselCards: [],
  optimizeCarouselOrder: true,
  multiShareEndCard: true,
  primaryText: "",
  headline: "",
  description: "",
  linkUrl: "",
  displayUrl: "",
  utmParams: {},
  cta: "LEARN_MORE",
});

export function CampaignWizard({
  clientId,
  accountId,
  defaultPageId,
  defaultIgId,
  open,
  onOpenChange,
  onComplete,
}: {
  clientId: string;
  accountId: string;
  defaultPageId: string | null;
  defaultIgId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [campaign, setCampaign] = useState<CampaignDraft>(blankCampaign);
  const [adset, setAdset] = useState<AdsetDraft>(blankAdset);
  const [ad, setAd] = useState<AdDraft>(() => blankAd(defaultPageId ?? "", defaultIgId));
  const [errors1, setErrors1] = useState<Record<string, string>>({});
  const [errors2, setErrors2] = useState<Record<string, string>>({});
  const [errors3, setErrors3] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<PageOpt[]>([]);
  const [igs, setIgs] = useState<IgOpt[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);

  // load discover for page/ig select
  useEffect(() => {
    if (!open) return;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return fetch(`/api/meta-ads/discover?clientId=${clientId}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
    })()
      .then((r) => r.json())
      .then((d) => {
        if (d?.pages) setPages(d.pages.map((p: any) => ({ id: p.id, name: p.name })));
        const igMap = new Map<string, IgOpt>();
        for (const p of d?.pages ?? [])
          if (p.instagram)
            igMap.set(p.instagram.id, { id: p.instagram.id, username: p.instagram.username ?? "" });
        for (const ig of d?.instagramAccounts ?? [])
          if (!igMap.has(ig.id)) igMap.set(ig.id, { id: ig.id, username: ig.username ?? "" });
        setIgs(Array.from(igMap.values()));
      })
      .catch(() => {});
  }, [open, clientId]);

  const v1 = useMemo(() => safeValidate(campaignSchema, campaign), [campaign]);
  const v2 = useMemo(() => safeValidate(adsetSchema, adset), [adset]);
  const v3 = useMemo(() => safeValidate(adSchema, ad), [ad]);
  const canPublish = v1.ok && v2.ok && v3.ok;

  const goNext = () => {
    if (step === 1) {
      if (!v1.ok) {
        setErrors1(v1.errors);
        return;
      }
      setErrors1({});
      setStep(2);
    } else if (step === 2) {
      if (!v2.ok) {
        setErrors2(v2.errors);
        return;
      }
      setErrors2({});
      setStep(3);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const { data: c, error: e1 } = await supabase
        .from("meta_ads_campaigns")
        .insert({
          client_id: clientId,
          name: campaign.name || "Borrador",
          objective: campaign.objective,
          status: "DRAFT",
          daily_budget:
            campaign.cboEnabled && campaign.budgetType === "daily" ? campaign.budgetAmount : null,
          lifetime_budget:
            campaign.cboEnabled && campaign.budgetType === "lifetime"
              ? campaign.budgetAmount
              : null,
          start_time: campaign.startTime ? campaign.startTime.slice(0, 10) : null,
          stop_time: campaign.endTime ? campaign.endTime.slice(0, 10) : null,
          spend_cap: campaign.spendCap,
          cbo_enabled: campaign.cboEnabled,
          bid_strategy: campaign.bidStrategy,
          buying_type: "AUCTION",
        })
        .select()
        .single();
      if (e1) throw e1;
      const { data: a, error: e2 } = await supabase
        .from("meta_ads_adsets")
        .insert({
          client_id: clientId,
          campaign_id: c.id,
          name: adset.name,
          status: "DRAFT",
          daily_budget: adset.budgetType === "daily" ? adset.budgetAmount : null,
          lifetime_budget: adset.budgetType === "lifetime" ? adset.budgetAmount : null,
          optimization_goal: adset.optimizationGoal,
          billing_event: adset.billingEvent,
          bid_amount: adset.bidAmount,
          age_min: adset.ageMin,
          age_max: adset.ageMax,
          genders: adset.gender,
          countries: adset.countries.join(","),
          cities: adset.cities,
          languages: adset.languages,
          interests: adset.interests.join(","),
          behaviors: adset.behaviors.join(","),
          demographics: adset.demographics.join(","),
          custom_audiences: adset.customAudiences,
          lookalike_audiences: adset.lookalikeAudiences,
          excluded_audiences: adset.excludedAudiences,
          placement_mode: adset.placementMode,
          placements: adset.placements,
          device_platforms: adset.devicePlatforms,
          user_os: adset.userOs,
          wifi_only: adset.wifiOnly,
          start_time: adset.startTime,
          end_time: adset.endTime,
        })
        .select()
        .single();
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("meta_ads_ads").insert({
        client_id: clientId,
        adset_id: a.id,
        name: ad.name,
        status: "DRAFT",
        format: ad.format,
        image_url: ad.imageUrl || null,
        video_url: ad.videoUrl || null,
        primary_text: ad.primaryText,
        headline: ad.headline,
        description: ad.description,
        link_url: applyUtm(ad.linkUrl, ad.utmParams),
        display_url: ad.displayUrl,
        cta: ad.cta as any,
        page_id: ad.pageId,
        instagram_actor_id: ad.instagramActorId,
        utm_params: ad.utmParams,
        carousel_cards: ad.carouselCards as any,
        optimize_carousel_order: ad.optimizeCarouselOrder,
        multi_share_end_card: ad.multiShareEndCard,
      });
      if (e3) throw e3;
      toast.success("Borrador guardado");
      onComplete();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (confirmedAmounts?: Record<string, number>) => {
    setPublishing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/meta-ads/publish-full", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          clientId,
          campaign,
          adset,
          ad: { ...ad, linkUrl: applyUtm(ad.linkUrl, ad.utmParams) },
          confirmedAmounts,
        }),
      });
      const json = await res.json();
      if (
        !res.ok &&
        json.code === BUDGET_CONFIRMATION_REQUIRED &&
        json.requiresConfirmation &&
        !confirmedAmounts
      ) {
        // High amounts need an explicit, human confirmation of the exact amounts before reaching Meta.
        setPublishing(false);
        if (confirm(`${json.error}\n\n¿Publicar con estos montos de todas formas?`))
          await publish(json.requiresConfirmation);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Error al publicar");
      toast.success(`Campaña publicada en Meta`, {
        description: `ID: ${json.fb_campaign_id}`,
        action: json.adAccountId
          ? {
              label: "Abrir en Meta",
              onClick: () =>
                window.open(adsManagerUrl(json.adAccountId, json.fb_campaign_id), "_blank"),
            }
          : undefined,
      });
      setConfirmOpen(false);
      onComplete();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const StepPill = ({ n, label, valid }: { n: 1 | 2 | 3; label: string; valid: boolean }) => (
    <button
      onClick={() => setStep(n)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-colors ${step === n ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
    >
      <span className="w-5 h-5 rounded-full bg-background/20 grid place-items-center">
        {valid ? <Check className="w-3 h-3" /> : n}
      </span>
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Asistente de campaña Meta Ads</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 pb-3 border-b">
          <StepPill n={1} label="Campaña" valid={v1.ok} />
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <StepPill n={2} label="Conjunto" valid={v2.ok} />
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <StepPill n={3} label="Anuncio" valid={v3.ok} />
          {!canPublish && (
            <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Faltan campos
            </span>
          )}
        </div>
        <div className="flex-1 overflow-auto py-4">
          {step === 1 && (
            <Step1Campaign
              draft={campaign}
              errors={errors1}
              onChange={(p) => setCampaign({ ...campaign, ...p })}
            />
          )}
          {step === 2 && (
            <Step2AdSet
              draft={adset}
              errors={errors2}
              onChange={(p) => setAdset({ ...adset, ...p })}
              cboEnabled={campaign.cboEnabled}
            />
          )}
          {step === 3 && (
            <Step3Ad
              clientId={clientId}
              draft={ad}
              errors={errors3}
              onChange={(p) => setAd({ ...ad, ...p })}
              pages={pages}
              igs={igs}
            />
          )}
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <Button variant="outline" onClick={saveDraft} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Guardar borrador
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
              disabled={step === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Atrás
            </Button>
            {step < 3 ? (
              <Button onClick={goNext}>
                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (!v3.ok) {
                    setErrors3(v3.errors);
                    return;
                  }
                  setConfirmOpen(true);
                }}
                disabled={!canPublish || !accountId}
              >
                <Rocket className="w-4 h-4 mr-1" /> Publicar en Meta
              </Button>
            )}
          </div>
        </div>
        <PublishConfirmModal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          campaign={campaign}
          adset={adset}
          ad={ad}
          publishing={publishing}
          onConfirm={() => publish()}
        />
      </DialogContent>
    </Dialog>
  );
}
