import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateMetaAccountAssets, type MetaAssetPatch } from "@/lib/meta/connection.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, RefreshCw, Megaphone, Layers, Image as ImageIcon, Sparkles, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { EmptyState, ErrorState } from "@/components/app";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { MediaUpload } from "./MediaUpload";
import { CampaignWizard } from "./meta-ads/CampaignWizard";

interface DiscoverPage {
  id: string;
  name: string;
  business: string;
  instagram: { id: string; username: string; avatar: string } | null;
}
interface DiscoverIG { id: string; username: string; avatar: string; source?: string }
interface DiscoverData {
  adAccounts: Array<{ id: string; name: string; status: number; business: string }>;
  pages: DiscoverPage[];
  instagramAccounts?: DiscoverIG[];
}

type MetaStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | "DRAFT";
type MetaObjective = "OUTCOME_AWARENESS" | "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_APP_PROMOTION" | "OUTCOME_SALES";
type MetaPlacement = "feed" | "stories" | "reels" | "marketplace" | "search" | "audience_network";
type MetaCTA = "LEARN_MORE" | "SHOP_NOW" | "SIGN_UP" | "SUBSCRIBE" | "CONTACT_US" | "BOOK_TRAVEL" | "DOWNLOAD" | "GET_OFFER" | "APPLY_NOW" | "SEND_MESSAGE" | "WATCH_MORE";

interface Account { id: string; client_id: string; ad_account_id: string | null; business_name: string | null; page_id: string | null; ig_account_id: string | null; last_synced_at: string | null; }
interface Campaign { id: string; client_id: string; name: string; objective: MetaObjective; status: MetaStatus; daily_budget: number | null; lifetime_budget: number | null; currency: string | null; start_time: string | null; stop_time: string | null; notes: string | null; position: number; fb_campaign_id: string | null; }
interface AdSet { id: string; client_id: string; campaign_id: string; name: string; status: MetaStatus; daily_budget: number | null; optimization_goal: string | null; audience_summary: string | null; age_min: number | null; age_max: number | null; genders: string | null; countries: string | null; interests: string | null; placements: string[]; position: number; }
interface Ad { id: string; client_id: string; adset_id: string; name: string; status: MetaStatus; format: string; image_url: string | null; video_url: string | null; carousel_urls: string[]; primary_text: string | null; headline: string | null; description: string | null; cta: MetaCTA | null; link_url: string | null; placement: MetaPlacement; position: number; }
interface Insight { id: string; campaign_id: string | null; date: string; impressions: number; reach: number; clicks: number; ctr: number | null; spend: number; cpm: number | null; messaging_conversations_started: number; }

const OBJECTIVES: Record<MetaObjective, string> = {
  OUTCOME_AWARENESS: "Reconocimiento", OUTCOME_TRAFFIC: "Tráfico", OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_LEADS: "Clientes potenciales", OUTCOME_APP_PROMOTION: "Promoción de app", OUTCOME_SALES: "Ventas",
};
const STATUSES: MetaStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED", "DELETED"];
const CTAS: MetaCTA[] = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "SUBSCRIBE", "CONTACT_US", "DOWNLOAD", "GET_OFFER", "APPLY_NOW", "SEND_MESSAGE", "WATCH_MORE", "BOOK_TRAVEL"];
const PLACEMENTS: MetaPlacement[] = ["feed", "stories", "reels", "marketplace", "search", "audience_network"];
/** Etiquetas en español solo para la UI; a Meta se envían los valores originales. */
const STATUS_LABELS: Record<MetaStatus, string> = {
  DRAFT: "Borrador", ACTIVE: "Activa", PAUSED: "Pausada", ARCHIVED: "Archivada", DELETED: "Eliminada",
};
const PLACEMENT_LABELS: Record<MetaPlacement, string> = {
  feed: "Feed", stories: "Historias", reels: "Reels", marketplace: "Marketplace",
  search: "Búsqueda", audience_network: "Audience Network",
};
type AccountIdField = "ad_account_id" | "page_id" | "ig_account_id";
const ACCOUNT_ID_FIELDS: readonly AccountIdField[] = ["ad_account_id", "page_id", "ig_account_id"];

function emptyAccount(clientId: string): Account {
  return {
    id: "", client_id: clientId, ad_account_id: null, business_name: null,
    page_id: null, ig_account_id: null, last_synced_at: null,
  };
}

/** Dominio legible de una URL de destino; null si no es una URL válida. */
function safeHostname(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

export function MetaAdsPanel({ clientId }: { clientId: string }) {
  const saveAssets = useServerFn(updateMetaAccountAssets);
  const { caps, loading: capsLoading } = useClientCapabilities(clientId);
  const [account, setAccount] = useState<Account | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverData, setDiscoverData] = useState<DiscoverData | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const authedFetch = async (path: string, body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error");
    return json;
  };

  const pushToMeta = async (entity: "campaign" | "adset" | "ad", id: string, patch: Record<string, any>) => {
    try {
      await authedFetch("/api/meta-ads/update", { entity, id, patch });
    } catch (e: any) {
      toast.error(`Meta: ${e.message}`);
    }
  };

  const openDiscover = async () => {
    setDiscoverOpen(true);
    if (discoverData) return;
    setDiscovering(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/meta-ads/discover?clientId=${clientId}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al detectar");
      setDiscoverData(json);
    } catch (e: any) {
      toast.error(e.message);
      setDiscoverOpen(false);
    } finally {
      setDiscovering(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await loadAll();
    } catch (e: any) {
      setLoadError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    const [acRes, csRes, asRes, adsRes, insRes] = await Promise.all([
      supabase.from("meta_accounts").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("meta_ads_campaigns").select("*").eq("client_id", clientId).order("position"),
      supabase.from("meta_ads_adsets").select("*").eq("client_id", clientId).order("position"),
      supabase.from("meta_ads_ads").select("*").eq("client_id", clientId).order("position"),
      supabase
        .from("ad_insights_daily")
        .select("id,campaign_id,date,impressions,reach,clicks,ctr,spend,cpm,messaging_conversations_started")
        .eq("client_id", clientId)
        .eq("level", "campaign")
        .order("date", { ascending: false }),
    ]);
    const firstError = [acRes, csRes, asRes, adsRes, insRes].find((r) => r.error)?.error;
    if (firstError) throw new Error(firstError.message);
    // Sin fila todavía: no se crea al abrir; el servidor la crea (upsert) al guardar o conectar.
    setAccount((acRes.data as Account | null) ?? emptyAccount(clientId));
    setCampaigns((csRes.data ?? []) as Campaign[]);
    setAdsets((asRes.data ?? []) as AdSet[]);
    setAds((adsRes.data ?? []) as Ad[]);
    setInsights((insRes.data ?? []) as Insight[]);
  };

  useEffect(() => { load(); }, [clientId]);

  const updateAccount = async (patch: MetaAssetPatch): Promise<boolean> => {
    if (!account) return false;
    const previous = account;
    setAccount({ ...account, ...patch });
    try {
      // Goes through the server so only agency editors can change linked ids.
      await saveAssets({ data: { clientId, patch } });
      return true;
    } catch (e: any) {
      setAccount(previous);
      toast.error(e?.message ?? "No se pudo guardar la cuenta de Meta");
      return false;
    }
  };

  /**
   * Guarda un campo de la cuenta solo si cambió. Vaciar un ID vinculado desconecta
   * la cuenta, así que exige confirmación explícita. Devuelve false si no se guardó.
   */
  const updateAccountField = async (field: keyof MetaAssetPatch, raw: string): Promise<boolean> => {
    if (!account) return false;
    const next = raw.trim() || null;
    const current = (account as any)[field] ?? null;
    if (next === current) return true;
    if (next === null && ACCOUNT_ID_FIELDS.includes(field as AccountIdField)) {
      if (!confirm("¿Desconectar esta cuenta? Se borrará el ID guardado.")) return false;
    }
    return updateAccount({ [field]: next } as MetaAssetPatch);
  };

  /** Aplica un patch local con revert si la escritura falla o no afecta filas (permisos). */
  const saveRow = async <T extends { id: string }>(
    table: "meta_ads_campaigns" | "meta_ads_adsets" | "meta_ads_ads",
    id: string,
    patch: Partial<T>,
    rows: T[],
    setter: (fn: (rows: T[]) => T[]) => void,
  ): Promise<boolean> => {
    const previous = rows.find((r) => r.id === id);
    setter((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { data, error } = await supabase.from(table).update(patch as any).eq("id", id).select("id");
    if (error || !data || data.length === 0) {
      if (previous) setter((list) => list.map((r) => (r.id === id ? previous : r)));
      toast.error(error ? `No se pudo guardar: ${error.message}` : "No se pudo guardar (sin permisos para editar)");
      return false;
    }
    return true;
  };

  const updateCampaign = async (id: string, patch: Partial<Campaign>) => {
    if (!(await saveRow<Campaign>("meta_ads_campaigns", id, patch, campaigns, setCampaigns))) return;
    const c = campaigns.find((x) => x.id === id);
    if (c?.fb_campaign_id) await pushToMeta("campaign", id, patch);
  };

  const removeCampaign = async (id: string) => {
    if (!confirm("¿Eliminar esta campaña? También se eliminará en Meta.")) return;
    try {
      await authedFetch("/api/meta-ads/archive", { entity: "campaign", id });
      setCampaigns(campaigns.filter((c) => c.id !== id));
      setAdsets(adsets.filter((a) => a.campaign_id !== id));
      setAds(ads.filter((ad) => !adsets.find((a) => a.id === ad.adset_id && a.campaign_id === id)));
      const gone = campaigns.find((c) => c.id === id)?.fb_campaign_id ?? null;
      setInsights(insights.filter((i) => !gone || i.campaign_id !== gone));
      toast.success("Eliminada en Meta");
    } catch (e: any) { toast.error(e.message); }
  };

  const updateAdSet = async (id: string, patch: Partial<AdSet>) => {
    if (!(await saveRow<AdSet>("meta_ads_adsets", id, patch, adsets, setAdsets))) return;
    const a = adsets.find((x) => x.id === id) as any;
    if (a?.fb_adset_id) await pushToMeta("adset", id, patch);
  };

  const removeAdSet = async (id: string) => {
    if (!confirm("¿Eliminar este conjunto? También se eliminará en Meta.")) return;
    try {
      await authedFetch("/api/meta-ads/archive", { entity: "adset", id });
      setAdsets(adsets.filter((a) => a.id !== id));
      setAds(ads.filter((ad) => ad.adset_id !== id));
      toast.success("Conjunto eliminado en Meta");
    } catch (e: any) { toast.error(e.message); }
  };

  const updateAd = async (id: string, patch: Partial<Ad>) => {
    if (!(await saveRow<Ad>("meta_ads_ads", id, patch, ads, setAds))) return;
    const a = ads.find((x) => x.id === id) as any;
    if (a?.fb_ad_id) await pushToMeta("ad", id, patch);
  };

  const removeAd = async (id: string) => {
    if (!confirm("¿Eliminar este anuncio? También se eliminará en Meta.")) return;
    try {
      await authedFetch("/api/meta-ads/archive", { entity: "ad", id });
      setAds(ads.filter((a) => a.id !== id));
      toast.success("Anuncio eliminado en Meta");
    } catch (e: any) { toast.error(e.message); }
  };


  const sync = async () => {
    if (!account?.ad_account_id) return toast.error("Configura primero el ID de cuenta publicitaria");
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/meta-ads/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al sincronizar");
      toast.success(`Sincronizado: ${json.campaigns ?? 0} campañas · ${json.adsets ?? 0} conjuntos · ${json.ads ?? 0} anuncios · ${json.insights ?? 0} métricas`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loadError) {
    return (
      <ErrorState
        title="No pudimos cargar Meta Ads"
        message={loadError}
        onRetry={() => void load()}
        retrying={loading}
      />
    );
  }

  if (!capsLoading && !caps.meta_connected && !account?.ad_account_id && campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Conecta Meta para gestionar campañas"
        description="Usa el botón «Conectar con Meta» de arriba o sigue la configuración guiada del cliente."
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/clients/$clientId/setup" params={{ clientId }}>Ir a la configuración</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Account config */}
      <div className="rounded-2xl border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Cuenta de Meta Ads</h3>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openDiscover}>
              <Sparkles className="w-4 h-4 mr-1" /> Autodetectar
            </Button>
            <Button size="sm" variant="outline" onClick={sync} disabled={syncing || !account?.ad_account_id}>
              <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Sincronizar con Meta"}
            </Button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="ID de cuenta publicitaria">
            <AccountInput
              placeholder="act_1234567890"
              value={account?.ad_account_id ?? null}
              disabled={!account}
              onCommit={(v) => updateAccountField("ad_account_id", v)}
            />
          </Field>
          <Field label="Nombre del negocio">
            <AccountInput
              placeholder="Mi marca"
              value={account?.business_name ?? null}
              disabled={!account}
              onCommit={(v) => updateAccountField("business_name", v)}
            />
          </Field>
          <Field label="ID de página de Facebook">
            <AccountInput
              placeholder="123456789"
              value={account?.page_id ?? null}
              disabled={!account}
              onCommit={(v) => updateAccountField("page_id", v)}
            />
          </Field>
          <Field label="ID de cuenta de Instagram">
            <AccountInput
              placeholder="178414..."
              value={account?.ig_account_id ?? null}
              disabled={!account}
              onCommit={(v) => updateAccountField("ig_account_id", v)}
            />
          </Field>
        </div>
        {account?.last_synced_at && (
          <p className="text-xs text-muted-foreground">Última sincronización: {new Date(account.last_synced_at).toLocaleString("es-CL")}</p>
        )}
      </div>

      {/* Campaigns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Campañas ({campaigns.length})</h3>
          <Button size="sm" onClick={() => setWizardOpen(true)} disabled={!account?.ad_account_id}>
            <Sparkles className="w-4 h-4 mr-1" /> Crear campaña en Meta
          </Button>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed rounded-xl">Aún no hay campañas. Crea una para empezar.</p>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {campaigns.map((c) => {
              const myAdsets = adsets.filter((a) => a.campaign_id === c.id);
              const myInsights = c.fb_campaign_id ? insights.filter((i) => i.campaign_id === c.fb_campaign_id) : [];
              return (
                <AccordionItem key={c.id} value={c.id} className="border rounded-xl bg-surface px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left flex-1">
                      <span className={`w-2 h-2 rounded-full ${c.status === "ACTIVE" ? "bg-green-500" : c.status === "PAUSED" ? "bg-yellow-500" : "bg-zinc-400"}`} />
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          {c.name}
                          {c.fb_campaign_id && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" aria-label="Publicada en Meta" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{OBJECTIVES[c.objective]} · {STATUS_LABELS[c.status] ?? c.status}{c.fb_campaign_id ? ` · ${c.fb_campaign_id}` : " · Solo local"}</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-5">
                    <div className="grid md:grid-cols-2 gap-3">
                      <Field label="Nombre">
                        <Input defaultValue={c.name} onBlur={(e) => updateCampaign(c.id, { name: e.target.value })} />
                      </Field>
                      <Field label="Objetivo">
                        <Select value={c.objective} onValueChange={(v) => updateCampaign(c.id, { objective: v as MetaObjective })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(OBJECTIVES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Estado">
                        <Select value={c.status} onValueChange={(v) => updateCampaign(c.id, { status: v as MetaStatus })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                        </Select>
                      </Field>
                      <Field label="Moneda">
                        <Input defaultValue={c.currency ?? "CLP"} onBlur={(e) => updateCampaign(c.id, { currency: e.target.value || null })} />
                      </Field>
                      <Field label="Presupuesto diario">
                        <Input type="number" defaultValue={c.daily_budget ?? ""} onBlur={(e) => updateCampaign(c.id, { daily_budget: e.target.value ? Number(e.target.value) : null })} />
                      </Field>
                      <Field label="Presupuesto total">
                        <Input type="number" defaultValue={c.lifetime_budget ?? ""} onBlur={(e) => updateCampaign(c.id, { lifetime_budget: e.target.value ? Number(e.target.value) : null })} />
                      </Field>
                      <Field label="Inicio">
                        <Input type="date" defaultValue={c.start_time ?? ""} onBlur={(e) => updateCampaign(c.id, { start_time: e.target.value || null })} />
                      </Field>
                      <Field label="Fin">
                        <Input type="date" defaultValue={c.stop_time ?? ""} onBlur={(e) => updateCampaign(c.id, { stop_time: e.target.value || null })} />
                      </Field>
                    </div>
                    <Field label="Notas">
                      <Textarea defaultValue={c.notes ?? ""} onBlur={(e) => updateCampaign(c.id, { notes: e.target.value || null })} />
                    </Field>

                    {/* Ad sets */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Layers className="w-4 h-4" /> Conjuntos de anuncios ({myAdsets.length})
                        </div>
                        <span />
                      </div>
                      {myAdsets.map((a) => {
                        const myAds = ads.filter((x) => x.adset_id === a.id);
                        return (
                          <div key={a.id} className="rounded-xl border p-4 space-y-3 bg-background">
                            <div className="flex items-start justify-between gap-2">
                              <Input className="font-medium" defaultValue={a.name} onBlur={(e) => updateAdSet(a.id, { name: e.target.value })} />
                              <Button size="icon" variant="ghost" onClick={() => removeAdSet(a.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                            <div className="grid md:grid-cols-3 gap-2">
                              <Field label="Estado">
                                <Select value={a.status} onValueChange={(v) => updateAdSet(a.id, { status: v as MetaStatus })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                                </Select>
                              </Field>
                              <Field label="Presupuesto diario">
                                <Input type="number" defaultValue={a.daily_budget ?? ""} onBlur={(e) => updateAdSet(a.id, { daily_budget: e.target.value ? Number(e.target.value) : null })} />
                              </Field>
                              <Field label="Optimización">
                                <Input placeholder="LINK_CLICKS, REACH…" defaultValue={a.optimization_goal ?? ""} onBlur={(e) => updateAdSet(a.id, { optimization_goal: e.target.value || null })} />
                              </Field>
                              <Field label="Edad mín.">
                                <Input type="number" defaultValue={a.age_min ?? ""} onBlur={(e) => updateAdSet(a.id, { age_min: e.target.value ? Number(e.target.value) : null })} />
                              </Field>
                              <Field label="Edad máx.">
                                <Input type="number" defaultValue={a.age_max ?? ""} onBlur={(e) => updateAdSet(a.id, { age_max: e.target.value ? Number(e.target.value) : null })} />
                              </Field>
                              <Field label="Géneros">
                                <Select value={a.genders ?? "all"} onValueChange={(v) => updateAdSet(a.id, { genders: v === "all" ? null : v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="female">Mujeres</SelectItem>
                                    <SelectItem value="male">Hombres</SelectItem>
                                  </SelectContent>
                                </Select>
                              </Field>
                            </div>
                            <Field label="Países (códigos ISO separados por coma)">
                              <Input placeholder="CL, MX, AR, ES…" defaultValue={a.countries ?? ""} onBlur={(e) => updateAdSet(a.id, { countries: e.target.value || null })} />
                            </Field>
                            <Field label="Intereses (separados por coma)">
                              <Input placeholder="moda, deporte, tecnología…" defaultValue={a.interests ?? ""} onBlur={(e) => updateAdSet(a.id, { interests: e.target.value || null })} />
                            </Field>
                            <Field label="Ubicaciones (publisher platforms)">
                              <div className="flex flex-wrap gap-3 pt-1">
                                {(["facebook", "instagram", "audience_network", "messenger"] as const).map((p) => {
                                  const checked = (a.placements ?? []).includes(p);
                                  return (
                                    <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          const cur = new Set(a.placements ?? []);
                                          if (e.target.checked) cur.add(p); else cur.delete(p);
                                          updateAdSet(a.id, { placements: Array.from(cur) });
                                        }}
                                      />
                                      {p === "audience_network" ? "Audience Network" : p === "facebook" ? "Facebook" : p === "instagram" ? "Instagram" : "Messenger"}
                                    </label>
                                  );
                                })}
                              </div>
                            </Field>
                            <Field label="Resumen de audiencia">
                              <Textarea rows={2} defaultValue={a.audience_summary ?? ""} onBlur={(e) => updateAdSet(a.id, { audience_summary: e.target.value || null })} />
                            </Field>

                            {/* Ads */}
                            <div className="space-y-2 pt-2 border-t">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-semibold">
                                  <ImageIcon className="w-3 h-3" /> Anuncios ({myAds.length})
                                </div>
                                <span />
                              </div>
                              {myAds.map((ad) => (
                                <div key={ad.id} className="rounded-lg border p-3 space-y-2 bg-surface">
                                  <div className="flex items-start justify-between gap-2">
                                    <Input className="font-medium" defaultValue={ad.name} onBlur={(e) => updateAd(ad.id, { name: e.target.value })} />
                                    <Button size="icon" variant="ghost" onClick={() => removeAd(ad.id)}><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                  <div className="grid md:grid-cols-3 gap-2">
                                    <Field label="Formato">
                                      <Select value={ad.format} onValueChange={(v) => updateAd(ad.id, { format: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="image">Imagen</SelectItem>
                                          <SelectItem value="video">Video</SelectItem>
                                          <SelectItem value="carousel">Carrusel</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </Field>
                                    <Field label="Ubicación">
                                      <Select value={ad.placement} onValueChange={(v) => updateAd(ad.id, { placement: v as MetaPlacement })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{PLACEMENTS.map((p) => <SelectItem key={p} value={p}>{PLACEMENT_LABELS[p]}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </Field>
                                    <Field label="CTA">
                                      <Select value={ad.cta ?? "LEARN_MORE"} onValueChange={(v) => updateAd(ad.id, { cta: v as MetaCTA })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{CTAS.map((cta) => <SelectItem key={cta} value={cta}>{CTA_LABELS[cta]}</SelectItem>)}</SelectContent>
                                      </Select>
                                    </Field>
                                  </div>
                                  {ad.format === "video" ? (
                                    <>
                                      <Field label="Video (URL o subir)">
                                        <MediaUpload clientId={clientId} value={ad.video_url} onChange={(url) => updateAd(ad.id, { video_url: url })} placeholder="URL del video o sube archivo" />
                                      </Field>
                                      <Field label="Miniatura / cover">
                                        <MediaUpload clientId={clientId} value={ad.image_url} onChange={(url) => updateAd(ad.id, { image_url: url })} />
                                      </Field>
                                    </>
                                  ) : (
                                    <Field label="Imagen">
                                      <MediaUpload clientId={clientId} value={ad.image_url} onChange={(url) => updateAd(ad.id, { image_url: url })} />
                                    </Field>
                                  )}
                                  <div className="grid md:grid-cols-2 gap-2">
                                    <Field label="Titular">
                                      <Input defaultValue={ad.headline ?? ""} onBlur={(e) => updateAd(ad.id, { headline: e.target.value || null })} />
                                    </Field>
                                    <Field label="URL de destino">
                                      <Input placeholder="https://tusitio.com/landing" defaultValue={ad.link_url ?? ""} onBlur={(e) => updateAd(ad.id, { link_url: e.target.value || null })} />
                                    </Field>
                                  </div>
                                  <Field label="Texto principal">
                                    <Textarea rows={2} defaultValue={ad.primary_text ?? ""} onBlur={(e) => updateAd(ad.id, { primary_text: e.target.value || null })} />
                                  </Field>
                                  <Field label="Descripción">
                                    <Input defaultValue={ad.description ?? ""} onBlur={(e) => updateAd(ad.id, { description: e.target.value || null })} />
                                  </Field>
                                  <AdPreview ad={ad} accountName={account?.business_name ?? "Tu marca"} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Insights */}
                    <div className="space-y-2 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Resultados / métricas</h4>
                        <span />
                      </div>
                      {myInsights.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aún no hay métricas registradas.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground">
                              <tr className="text-left border-b">
                                <th className="py-1 pr-2">Fecha</th>
                                <th className="py-1 pr-2">Impr.</th>
                                <th className="py-1 pr-2">Alcance</th>
                                <th className="py-1 pr-2">Clics</th>
                                <th className="py-1 pr-2">CTR %</th>
                                <th className="py-1 pr-2">Gasto</th>
                                <th className="py-1 pr-2">CPM</th>
                                <th className="py-1 pr-2">Conversaciones</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {myInsights.map((i) => (
                                <tr key={i.id} className="border-b">
                                  <td className="py-1 pr-2">{i.date}</td>
                                  <td className="py-1 pr-2">{i.impressions}</td>
                                  <td className="py-1 pr-2">{i.reach}</td>
                                  <td className="py-1 pr-2">{i.clicks}</td>
                                  <td className="py-1 pr-2">{i.ctr ?? "—"}</td>
                                  <td className="py-1 pr-2">{i.spend}</td>
                                  <td className="py-1 pr-2">{i.cpm ?? "—"}</td>
                                  <td className="py-1 pr-2">{i.messaging_conversations_started}</td>
                                  <td></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t flex justify-between items-center gap-2">
                      {c.fb_campaign_id ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Sincronizada con Meta · {c.fb_campaign_id}
                        </span>
                      ) : <span />}
                      <Button variant="ghost" size="sm" onClick={() => removeCampaign(c.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-1" /> Eliminar campaña
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {account?.ad_account_id && (
        <CampaignWizard
          clientId={clientId}
          accountId={account.ad_account_id}
          defaultPageId={account.page_id}
          defaultIgId={account.ig_account_id}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onComplete={() => { setWizardOpen(false); load(); }}
        />
      )}

      {/* Discover dialog */}
      <Dialog open={discoverOpen} onOpenChange={setDiscoverOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activos detectados en Meta</DialogTitle>
            <DialogDescription>Selecciona la cuenta publicitaria y la página para vincularlas a este cliente.</DialogDescription>
          </DialogHeader>
          {discovering ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Buscando…</p>
          ) : discoverData ? (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-sm font-semibold mb-2">Cuentas publicitarias</h4>
                {discoverData.adAccounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No se encontraron cuentas publicitarias.</p>
                ) : (
                  <div className="space-y-1.5">
                    {discoverData.adAccounts.map((a) => (
                      <button
                        key={a.id}
                        onClick={async () => { if (await updateAccount({ ad_account_id: a.id, business_name: a.business })) toast.success(`Cuenta ${a.name} vinculada`); }}
                        className={`w-full text-left rounded-lg border p-3 text-sm hover:bg-muted transition-colors ${account?.ad_account_id === a.id ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.id} · {a.business} · {a.status === 1 ? "Activa" : `Estado ${a.status}`}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Página de Facebook</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  La página es la "identidad" del anuncio en Facebook (aparece como remitente del post).
                </p>
                {discoverData.pages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No se encontraron páginas.</p>
                ) : (
                  <div className="space-y-1.5">
                    {discoverData.pages.map((p) => {
                      const pageSelected = account?.page_id === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={async () => {
                            if (await updateAccount({ page_id: p.id })) toast.success(`Página ${p.name} vinculada`);
                          }}
                          className={`w-full text-left rounded-lg border p-3 text-sm hover:bg-muted transition-colors ${pageSelected ? "border-primary bg-primary/5" : ""}`}
                        >
                          <div className="font-medium">{p.name} {pageSelected && <span className="text-xs text-primary">· seleccionada</span>}</div>
                          <div className="text-xs text-muted-foreground">{p.id}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">Cuenta de Instagram</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Elige desde qué cuenta de Instagram saldrán los anuncios. Así la gente le escribirá directamente al cliente.
                </p>
                {(() => {
                  // Unimos IGs vinculados a páginas + IGs detectados aparte (sin duplicar)
                  const merged = new Map<string, DiscoverIG>();
                  for (const p of discoverData.pages) {
                    if (p.instagram) merged.set(p.instagram.id, { ...p.instagram, source: `vinculado a ${p.name}` });
                  }
                  for (const ig of discoverData.instagramAccounts ?? []) {
                    if (!merged.has(ig.id)) merged.set(ig.id, ig);
                  }
                  const list = Array.from(merged.values());
                  if (list.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
                        No se detectaron cuentas de Instagram. Verifica en Business Settings → Usuarios → System Users que la cuenta IG esté asignada al System User con los permisos <strong>instagram_basic</strong> e <strong>instagram_content_publish</strong>.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-1.5">
                      {list.map((ig) => {
                        const selected = account?.ig_account_id === ig.id;
                        return (
                          <div
                            key={ig.id}
                            className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-sm ${selected ? "border-primary bg-primary/5" : ""}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {ig.avatar && <img src={ig.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />}
                              <div className="min-w-0">
                                <div className="font-medium truncate">@{ig.username || ig.id}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {ig.id}{ig.source ? ` · ${ig.source}` : ""}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={selected ? "default" : "outline"}
                              onClick={async () => {
                                if (await updateAccount({ ig_account_id: ig.id })) toast.success(`Anuncios saldrán desde @${ig.username || ig.id}`);
                              }}
                            >
                              {selected ? "IG vinculado" : "Usar este IG"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Input controlado de la cuenta: refleja el valor guardado cuando llega (evita que un
 * input montado antes de cargar quede vacío y borre el dato al perder foco).
 */
function AccountInput({
  value, placeholder, disabled, onCommit,
}: {
  value: string | null;
  placeholder: string;
  disabled?: boolean;
  onCommit: (value: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => { setDraft(value ?? ""); }, [value]);
  return (
    <Input
      placeholder={placeholder}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={async () => {
        const ok = await onCommit(draft);
        if (!ok) setDraft(value ?? "");
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const CTA_LABELS: Record<MetaCTA, string> = {
  LEARN_MORE: "Más información", SHOP_NOW: "Comprar ahora", SIGN_UP: "Registrarse",
  SUBSCRIBE: "Suscribirse", CONTACT_US: "Contáctanos", BOOK_TRAVEL: "Reservar",
  DOWNLOAD: "Descargar", GET_OFFER: "Ver oferta", APPLY_NOW: "Aplicar",
  SEND_MESSAGE: "Enviar mensaje", WATCH_MORE: "Ver más",
};

function AdPreview({ ad, accountName }: { ad: Ad; accountName: string }) {
  return (
    <div className="rounded-xl border bg-white text-zinc-900 max-w-sm mx-auto overflow-hidden text-xs">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-7 h-7 rounded-full bg-zinc-200" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{accountName}</div>
          <div className="text-[10px] text-zinc-500">Patrocinado</div>
        </div>
      </div>
      {ad.primary_text && <div className="px-3 pb-2 whitespace-pre-wrap">{ad.primary_text}</div>}
      <div className="bg-zinc-100 aspect-square w-full grid place-items-center">
        {ad.image_url ? (
          <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-8 h-8 text-zinc-400" />
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50">
        <div className="min-w-0">
          {ad.link_url && safeHostname(ad.link_url) && <div className="text-[10px] text-zinc-500 uppercase truncate">{safeHostname(ad.link_url)}</div>}
          {ad.headline && <div className="font-semibold truncate">{ad.headline}</div>}
          {ad.description && <div className="text-[10px] text-zinc-500 truncate">{ad.description}</div>}
        </div>
        <button className="ml-2 text-[10px] font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded shrink-0">
          {CTA_LABELS[ad.cta ?? "LEARN_MORE"]}
        </button>
      </div>
    </div>
  );
}
