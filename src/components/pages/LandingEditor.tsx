import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { uniqueSlug, slugify } from "@/lib/slug";
import { uploadClientMedia } from "@/lib/uploadMedia";
import { Plus, Trash2, ExternalLink, Copy, Eye, Globe, Mail, Smartphone, Monitor, MessageCircle, AlertTriangle, Moon, MapPin, HelpCircle, Quote, Activity, Search, GripVertical, ChevronDown } from "lucide-react";
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EventsPanel } from "@/components/landing/EventsPanel";
import { LandingAnalytics } from "@/components/landing/LandingAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { landingWhatsappText } from "@/lib/landingWhatsapp";
import { PublicLandingView } from "@/components/landing/PublicLandingView";
import {
  TEMPLATE_LABEL, HERO_ASPECT_LABEL, SERVICE_ICON_KEYS, SERVICE_ICONS,
  landingPalette, defaultHours, WEEKDAYS, asArray, asObject,
  type LandingTemplate, type HeroAspect, type Testimonial, type FaqItem,
  type LandingLocation, type LandingFooter,
  LANDING_SECTION_LABEL, LANDING_SECTION_KEYS, resolveSectionOrder, type LandingSectionKey,
} from "@/lib/landingTheme";


type Service = { title: string; description: string; icon?: string };
type GalleryItem = { url: string; caption?: string };

type Landing = {
  id: string;
  client_id: string;
  slug: string;
  published: boolean;
  theme_color: string;
  hero_title: string;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  services: Service[];
  gallery: GalleryItem[];
  contact_enabled: boolean;
  view_count: number;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  whatsapp_cta_text: string | null;
  whatsapp_message: string | null;
  template: LandingTemplate;
  dark_mode: boolean;
  hero_aspect: HeroAspect;
  testimonials_enabled: boolean;
  testimonials: Testimonial[];
  location_enabled: boolean;
  location: LandingLocation;
  faq_enabled: boolean;
  faq: FaqItem[];
  footer: LandingFooter;
  seo_title: string | null;
  seo_description: string | null;
  section_order: LandingSectionKey[];
};


type Submission = { id: string; name: string; email: string; phone: string | null; message: string; created_at: string };

export function LandingEditor({ clientId }: { clientId: string }) {
  const { client } = useActiveClient();
  const [lp, setLp] = useState<Landing | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");
  const [tab, setTab] = useState<"diseno" | "config" | "metricas">("diseno");
  const [openSection, setOpenSection] = useState<string | null>("estilo");
  const [baseline, setBaseline] = useState<string>("");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const dirty = !!lp && baseline !== JSON.stringify(lp);
  const order = lp ? lp.section_order : [...LANDING_SECTION_KEYS];

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const discard = () => { if (baseline) setLp(JSON.parse(baseline)); };

  const onDragEnd = (e: DragEndEvent) => {
    if (!lp || !e.over || e.active.id === e.over.id) return;
    const from = order.indexOf(e.active.id as LandingSectionKey);
    const to = order.indexOf(e.over.id as LandingSectionKey);
    if (from < 0 || to < 0) return;
    update({ section_order: arrayMove(order, from, to) });
  };

  /** Scrolls the rendered preview to the matching section, or the nearest visible one. */
  const scrollPreviewTo = (key: string) => {
    requestAnimationFrame(() => {
      const root = previewRef.current;
      if (!root) return;
      const candidates = [key, ...order, "hero"];
      let el: HTMLElement | null = null;
      for (const c of candidates) {
        el = root.querySelector<HTMLElement>(`[data-section="${c}"]`);
        if (el) break;
      }
      if (!el) return;
      root.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: "smooth" });
      el.style.transition = "outline-color 400ms ease";
      el.style.outline = "2px solid rgba(59,130,246,0.9)";
      el.style.outlineOffset = "-2px";
      setTimeout(() => { if (el) el.style.outline = "none"; }, 1200);
    });
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("landing_pages").select("*").eq("client_id", clientId).maybeSingle();
    const normalized = data ? normalize(data) : null;
    setLp(normalized);
    setBaseline(normalized ? JSON.stringify(normalized) : "");
    if (data) {
      const { data: s } = await supabase.from("landing_contact_submissions")
        .select("id,name,email,phone,message,created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false });
      setSubs((s ?? []) as Submission[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const create = async () => {
    if (!client) return;
    const base = client.instagram_handle || slugify(client.name);
    const slug = await uniqueSlug("landing_pages", base);
    const { data, error } = await supabase.from("landing_pages").insert({
      client_id: clientId, slug, hero_title: client.name,
      hero_subtitle: "Descripción breve y atractiva", cta_text: "Contáctanos",
    }).select("*").single();
    if (error) return toast.error(error.message);
    const created = normalize(data);
    setLp(created);
    setBaseline(JSON.stringify(created));
    toast.success("Landing creada");
  };

  const update = (patch: Partial<Landing>) => lp && setLp({ ...lp, ...patch });

  const save = async () => {
    if (!lp) return;
    setSaving(true);
    const { error } = await supabase.from("landing_pages").update({
      slug: slugify(lp.slug) || lp.slug,
      theme_color: lp.theme_color,
      hero_title: lp.hero_title,
      hero_subtitle: lp.hero_subtitle,
      hero_image_url: lp.hero_image_url,
      cta_text: lp.cta_text,
      cta_url: lp.cta_url,
      services: lp.services,
      gallery: lp.gallery,
      contact_enabled: lp.contact_enabled,
      whatsapp_enabled: lp.whatsapp_enabled,
      whatsapp_number: lp.whatsapp_number,
      whatsapp_cta_text: lp.whatsapp_cta_text,
      whatsapp_message: lp.whatsapp_message,
      template: lp.template,
      dark_mode: lp.dark_mode,
      hero_aspect: lp.hero_aspect,
      testimonials_enabled: lp.testimonials_enabled,
      testimonials: lp.testimonials as any,
      location_enabled: lp.location_enabled,
      location: lp.location as any,
      faq_enabled: lp.faq_enabled,
      faq: lp.faq as any,
      footer: lp.footer as any,
      seo_title: lp.seo_title,
      seo_description: lp.seo_description,
      section_order: lp.section_order,

    }).eq("id", lp.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setBaseline(JSON.stringify(lp));
    toast.success("Guardado");
  };

  const togglePub = async () => {
    if (!lp) return;
    const { error } = await supabase.from("landing_pages").update({ published: !lp.published }).eq("id", lp.id);
    if (error) return toast.error(error.message);
    const next = { ...lp, published: !lp.published };
    setLp(next);
    setBaseline(b => b ? JSON.stringify({ ...JSON.parse(b), published: next.published }) : b);
  };

  const uploadHero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !lp) return;
    try {
      const url = await uploadClientMedia(f, clientId);
      update({ hero_image_url: url });
    } catch (err: any) { toast.error(err.message); }
  };

  const addGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length || !lp) return;
    try {
      const urls = await Promise.all(files.map(f => uploadClientMedia(f, clientId)));
      update({ gallery: [...lp.gallery, ...urls.map(url => ({ url }))] });
    } catch (err: any) { toast.error(err.message); }
  };

  const removeGallery = (i: number) => lp && update({ gallery: lp.gallery.filter((_, k) => k !== i) });
  const addService = () => lp && update({ services: [...lp.services, { title: "Nuevo servicio", description: "" }] });
  const updService = (i: number, patch: Partial<Service>) => lp && update({
    services: lp.services.map((s, k) => k === i ? { ...s, ...patch } : s),
  });
  const rmService = (i: number) => lp && update({ services: lp.services.filter((_, k) => k !== i) });

  const updTestimonial = (i: number, patch: Partial<Testimonial>) => lp && update({
    testimonials: lp.testimonials.map((t, k) => k === i ? { ...t, ...patch } : t),
  });
  const uploadTestimonialPhoto = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const url = await uploadClientMedia(f, clientId);
      updTestimonial(i, { photo_url: url });
    } catch (err: any) { toast.error(err.message); }
  };
  const updFaq = (i: number, patch: Partial<FaqItem>) => lp && update({
    faq: lp.faq.map((f, k) => k === i ? { ...f, ...patch } : f),
  });
  const updHour = (i: number, patch: Partial<{ closed: boolean; from: string; to: string }>) => {
    if (!lp) return;
    const hours = (lp.location.hours ?? defaultHours()).map((h, k) => k === i ? { ...h, ...patch } : h);
    update({ location: { ...lp.location, hours } });
  };
  const updFooter = (patch: Partial<LandingFooter>) => lp && update({ footer: { ...lp.footer, ...patch } });
  const updLegal = (i: number, patch: Partial<{ label: string; url: string }>) => {
    if (!lp) return;
    const legal = (lp.footer.legal ?? []).map((l, k) => k === i ? { ...l, ...patch } : l);
    updFooter({ legal });
  };



  const deleteSub = async (id: string) => {
    const { error } = await supabase.from("landing_contact_submissions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSubs(subs.filter(s => s.id !== id));
  };

  if (loading) return <div className="p-10 text-muted-foreground">Cargando…</div>;

  if (!lp) {
    return (
      <div className="rounded-3xl border bg-surface p-10 text-center max-w-xl mx-auto">
        <Globe className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold mb-2">Landing page</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Crea una página de aterrizaje con hero, servicios, galería y formulario de contacto para {client?.name}.
        </p>
        <Button onClick={create}><Plus className="w-4 h-4 mr-1" /> Crear landing</Button>
      </div>
    );
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/@${lp.slug}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Landing page</h1>
          <p className="text-sm text-muted-foreground">Edita las secciones y publica cuando esté listo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-2 text-sm">
            <Switch checked={lp.published} onCheckedChange={togglePub} />
            {lp.published ? "Publicado" : "Borrador"}
          </Label>
          {lp.published ? (
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <Eye className="w-4 h-4 mr-1" /> Vista previa
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => toast.info("Publica la landing para abrir la vista previa pública")}>
              <Eye className="w-4 h-4 mr-1" /> Vista previa
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-5">
        <TabsList>
          <TabsTrigger value="diseno">Diseño</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="diseno">
      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        <div className="space-y-3 min-w-0">
          <EditorRow
            id="estilo"
            title="Estilo"
            summary={`${lp.template} · ${lp.dark_mode ? "oscuro" : "claro"}`}
            active
            open={openSection === "estilo"}
            onToggle={() => toggleSection("estilo")}
          >
            <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Color principal</Label>
                <Input type="color" value={lp.theme_color} onChange={e => update({ theme_color: e.target.value })} className="h-9 p-1" />
              </div>
              <div>
                <Label className="text-xs">Plantilla</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={lp.template}
                  onChange={e => update({ template: e.target.value as LandingTemplate })}
                >
                  {Object.entries(TEMPLATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Proporción de la imagen</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={lp.hero_aspect}
                  onChange={e => update({ hero_aspect: e.target.value as HeroAspect })}
                >
                  {Object.entries(HERO_ASPECT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <Label className="flex items-center gap-2 text-sm mt-5">
                <Switch checked={lp.dark_mode} onCheckedChange={v => update({ dark_mode: v })} />
                <Moon className="w-4 h-4" /> Modo oscuro
              </Label>
            </div>
            {landingPalette(lp.theme_color, lp.dark_mode).lowContrast && (
              <p className="text-xs flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                Este color tiene poco contraste sobre el fondo ({landingPalette(lp.theme_color, lp.dark_mode).contrast.toFixed(1)}:1).
                Los textos usarán una versión más legible del color; el color original se mantiene en el botón.
              </p>
            )}
            </div>
          </EditorRow>

          <EditorRow
            id="hero"
            title="Hero"
            summary={lp.hero_title || "Sin título"}
            active
            open={openSection === "hero"}
            onToggle={() => toggleSection("hero")}
          >
            <div className="space-y-3">
            <Input placeholder="Título" value={lp.hero_title} onChange={e => update({ hero_title: e.target.value })} maxLength={120} />
            <Textarea placeholder="Subtítulo" value={lp.hero_subtitle ?? ""} onChange={e => update({ hero_subtitle: e.target.value })} rows={2} maxLength={300} />
            <div className="flex items-center gap-3">
              {lp.hero_image_url && <img src={lp.hero_image_url} alt="" className="w-24 h-24 object-cover rounded" />}
              <label className="text-sm text-primary cursor-pointer hover:underline">
                {lp.hero_image_url ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" className="hidden" onChange={uploadHero} />
              </label>
              {lp.hero_image_url && <Button size="sm" variant="ghost" onClick={() => update({ hero_image_url: null })}>Quitar</Button>}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Input placeholder="Texto del botón CTA" value={lp.cta_text ?? ""} onChange={e => update({ cta_text: e.target.value })} maxLength={40} />
              <Input placeholder="URL del CTA (opcional)" value={lp.cta_url ?? ""} onChange={e => update({ cta_url: e.target.value })} maxLength={500} />
            </div>
            </div>
          </EditorRow>

          <h3 className="text-xs uppercase tracking-widest text-muted-foreground pt-3">Secciones de la página</h3>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {order.map(k => (
                  <SortableRow
                    key={k}
                    id={k}
                    title={LANDING_SECTION_LABEL[k]}
                    summary={sectionSummary(k)}
                    active={sectionActive(k)}
                    disabled={!sectionActive(k) && sectionToggleable(k)}
                    open={openSection === k}
                    onToggle={() => toggleSection(k)}
                    switchEl={sectionSwitch(k)}
                  >
                    {sectionContent(k)}
                  </SortableRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="sticky bottom-0 z-20 -mx-1 mt-4 rounded-xl border bg-surface/95 backdrop-blur px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {dirty ? "Cambios sin guardar" : "Todo guardado"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={discard} disabled={!dirty || saving}>Descartar</Button>
              <Button size="sm" onClick={save} disabled={!dirty || saving}>Guardar</Button>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="lg:sticky lg:top-20 h-fit space-y-3">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode("mobile")}
              className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1 transition ${previewMode === "mobile" ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Móvil
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("desktop")}
              className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1 transition ${previewMode === "desktop" ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              <Monitor className="w-3.5 h-3.5" /> Escritorio
            </button>
          </div>

          {previewMode === "mobile" ? (
            <div className="mx-auto" style={{ width: 300 }}>
              <div className="relative rounded-[3rem] bg-black p-2 shadow-2xl">
                <div className="relative rounded-[2.5rem] overflow-hidden bg-white text-gray-900" style={{ aspectRatio: "9/19.5" }}>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-6 bg-black rounded-full z-30" />
                  <div ref={previewRef} className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <LandingPreview lp={lp} compact />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full">
              <div className="relative rounded-t-xl bg-black p-2 shadow-2xl">
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-zinc-700 rounded-full" />
                <div className="relative rounded-md overflow-hidden bg-white text-gray-900 mt-1.5" style={{ aspectRatio: "16/10" }}>
                  <div ref={previewRef} className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <LandingPreview lp={lp} compact={false} />
                  </div>
                </div>
              </div>
              <div className="relative mx-auto h-3 bg-zinc-800 rounded-b-xl" style={{ width: "110%", marginLeft: "-5%" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-zinc-700 rounded-b-md" />
              </div>
            </div>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <div className="rounded-2xl border bg-surface p-5 space-y-3">
            <h3 className="font-medium text-sm">Publicación</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <Label className="text-xs">Slug (URL)</Label>
                <Input value={lp.slug} onChange={e => update({ slug: e.target.value })} />
              </div>
              <Label className="flex items-center gap-2 text-sm h-9">
                <Switch checked={lp.published} onCheckedChange={togglePub} />
                {lp.published ? "Publicado" : "Borrador"}
              </Label>
              <Button onClick={save} disabled={saving}>Guardar</Button>
            </div>
          </div>

        <div className="rounded-2xl border bg-surface p-5 flex flex-wrap items-center gap-3">
          <div className="text-sm text-muted-foreground">URL pública:</div>
          <code className="text-sm bg-secondary px-2 py-1 rounded break-all">{publicUrl}</code>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copiado"); }}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          {lp.published && (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-1 text-primary hover:underline">
              Abrir <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {lp.view_count} visitas acumuladas
          </div>
        </div>

          <section className="rounded-2xl border bg-surface p-5 space-y-3">
            <h3 className="font-medium flex items-center gap-2"><Search className="w-4 h-4" /> SEO</h3>
            <p className="text-xs text-muted-foreground">
              Si lo dejas vacío se usa el título y subtítulo del hero.
            </p>
            <div>
              <Label className="text-xs">Título SEO</Label>
              <Input
                placeholder={lp.hero_title}
                value={lp.seo_title ?? ""}
                onChange={e => update({ seo_title: e.target.value })}
                maxLength={60}
              />
              <p className="text-[11px] text-muted-foreground mt-1">{(lp.seo_title ?? "").length}/60 caracteres</p>
            </div>
            <div>
              <Label className="text-xs">Descripción SEO</Label>
              <Textarea
                rows={2}
                placeholder={lp.hero_subtitle ?? lp.hero_title}
                value={lp.seo_description ?? ""}
                onChange={e => update({ seo_description: e.target.value })}
                maxLength={160}
              />
              <p className="text-[11px] text-muted-foreground mt-1">{(lp.seo_description ?? "").length}/160 caracteres</p>
            </div>
          </section>

            <section className="rounded-2xl border bg-surface p-5 space-y-3">
              <h3 className="font-medium">Pie de página</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <Input placeholder="Email de contacto" value={lp.footer.email ?? ""} onChange={e => updFooter({ email: e.target.value })} maxLength={160} />
              <Input placeholder="Teléfono" value={lp.footer.phone ?? ""} onChange={e => updFooter({ phone: e.target.value })} maxLength={40} />
              <Input placeholder="Dirección" value={lp.footer.address ?? ""} onChange={e => updFooter({ address: e.target.value })} maxLength={200} />
              <Input placeholder="WhatsApp (+56...)" value={lp.footer.whatsapp ?? ""} onChange={e => updFooter({ whatsapp: e.target.value })} maxLength={40} />
              <Input placeholder="URL Instagram" value={lp.footer.instagram ?? ""} onChange={e => updFooter({ instagram: e.target.value })} maxLength={300} />
              <Input placeholder="URL Facebook" value={lp.footer.facebook ?? ""} onChange={e => updFooter({ facebook: e.target.value })} maxLength={300} />
              <Input placeholder="URL TikTok" value={lp.footer.tiktok ?? ""} onChange={e => updFooter({ tiktok: e.target.value })} maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Enlaces legales (opcional)</Label>
              {(lp.footer.legal ?? []).map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Etiqueta" value={l.label} onChange={e => updLegal(i, { label: e.target.value })} maxLength={60} />
                  <Input placeholder="URL" value={l.url} onChange={e => updLegal(i, { url: e.target.value })} maxLength={300} />
                  <Button size="icon" variant="ghost" onClick={() => updFooter({ legal: (lp.footer.legal ?? []).filter((_, k) => k !== i) })}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => updFooter({ legal: [...(lp.footer.legal ?? []), { label: "", url: "" }] })}>
                <Plus className="w-4 h-4 mr-1" /> Añadir enlace
              </Button>
            </div>
            </section>

            <section className="rounded-2xl border bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2"><Mail className="w-4 h-4" /> Formulario de contacto</h3>
                <Switch checked={lp.contact_enabled} onCheckedChange={v => update({ contact_enabled: v })} />
              </div>
              <div className="text-sm text-muted-foreground">
                {subs.length} mensaje{subs.length !== 1 ? "s" : ""} recibido{subs.length !== 1 ? "s" : ""}.
              </div>
              <ul className="space-y-2">
                {subs.map(s => (
                  <li key={s.id} className="rounded-lg border bg-background p-3 text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{s.name} <span className="text-muted-foreground font-normal">· {s.email}{s.phone ? ` · ${s.phone}` : ""}</span></div>
                        <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                        <p className="mt-1 whitespace-pre-line">{s.message}</p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => deleteSub(s.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
        </TabsContent>

        <TabsContent value="metricas" className="space-y-6">
          {!lp.published ? (
            <div className="rounded-2xl border border-dashed bg-surface p-8 text-center space-y-2">
              <Activity className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="font-medium">Esta landing no está publicada</p>
              <p className="text-sm text-muted-foreground">
                Todavía no se registran visitas ni conversiones porque la página no es pública.
                Publícala en Configuración para empezar a medir.
              </p>
            </div>
          ) : (
            <>
              <LandingAnalytics clientId={clientId} landingId={lp.id} />
                <EventsPanel clientId={clientId} sourceType="landing" sourceId={lp.id} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  /* ---- accordion / ordering helpers (hoisted declarations used by the JSX above) ---- */

  function toggleSection(k: string) {
    setOpenSection(prev => {
      const next = prev === k ? null : k;
      if (next) scrollPreviewTo(next);
      return next;
    });
  }

  function sectionToggleable(k: LandingSectionKey) {
    return k === "whatsapp" || k === "testimonios" || k === "ubicacion" || k === "faq";
  }

  function sectionActive(k: LandingSectionKey): boolean {
    if (!lp) return false;
    switch (k) {
      case "servicios": return lp.services.length > 0;
      case "galeria": return lp.gallery.length > 0;
      case "whatsapp": return !!lp.whatsapp_enabled;
      case "testimonios": return !!lp.testimonials_enabled;
      case "ubicacion": return !!lp.location_enabled;
      case "faq": return !!lp.faq_enabled;
    }
  }

  function sectionSummary(k: LandingSectionKey): string {
    if (!lp) return "";
    if (sectionToggleable(k) && !sectionActive(k)) return "Desactivado";
    switch (k) {
      case "servicios": return lp.services.length ? `${lp.services.length} servicio${lp.services.length !== 1 ? "s" : ""}` : "Sin servicios";
      case "galeria": return lp.gallery.length ? `${lp.gallery.length} imagen${lp.gallery.length !== 1 ? "es" : ""}` : "Sin imágenes";
      case "whatsapp": return lp.whatsapp_number || "Sin número";
      case "testimonios": return lp.testimonials.length ? `${lp.testimonials.length} testimonio${lp.testimonials.length !== 1 ? "s" : ""}` : "Sin testimonios";
      case "ubicacion": return lp.location.address || "Sin dirección";
      case "faq": return lp.faq.length ? `${lp.faq.length} pregunta${lp.faq.length !== 1 ? "s" : ""}` : "Sin preguntas";
    }
  }

  function sectionSwitch(k: LandingSectionKey) {
    if (!lp || !sectionToggleable(k)) return null;
    const map = {
      whatsapp: [lp.whatsapp_enabled, (v: boolean) => update({ whatsapp_enabled: v })],
      testimonios: [lp.testimonials_enabled, (v: boolean) => update({ testimonials_enabled: v })],
      ubicacion: [lp.location_enabled, (v: boolean) => update({ location_enabled: v })],
      faq: [lp.faq_enabled, (v: boolean) => update({ faq_enabled: v })],
    } as Record<string, [boolean, (v: boolean) => void]>;
    const [checked, onChange] = map[k]!;
    return <Switch checked={checked} onCheckedChange={onChange} />;
  }

  function sectionContent(k: LandingSectionKey) {
    if (!lp) return null;
    switch (k) {
      case "servicios": return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Servicios</h3>
              <Button size="sm" variant="outline" onClick={addService}><Plus className="w-4 h-4 mr-1" /> Añadir</Button>
            </div>
            {lp.services.length === 0 && <p className="text-sm text-muted-foreground">Sin servicios.</p>}
            <ul className="space-y-2">
              {lp.services.map((s, i) => (
                <li key={i} className="rounded-xl border bg-background p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Título" value={s.title} onChange={e => updService(i, { title: e.target.value })} maxLength={80} />
                    <Button size="icon" variant="ghost" onClick={() => rmService(i)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <Textarea placeholder="Descripción" value={s.description} onChange={e => updService(i, { description: e.target.value })} rows={2} maxLength={300} />
                  <div>
                    <Label className="text-xs">Icono</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => updService(i, { icon: undefined })}
                        className={`w-8 h-8 rounded-md border grid place-items-center text-[10px] ${!s.icon ? "border-primary bg-primary/10" : ""}`}
                        title="Sin icono (número)"
                      >
                        {i + 1}
                      </button>
                      {SERVICE_ICON_KEYS.map(k => {
                        const Icon = SERVICE_ICONS[k];
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => updService(i, { icon: k })}
                            className={`w-8 h-8 rounded-md border grid place-items-center ${s.icon === k ? "border-primary bg-primary/10" : ""}`}
                            title={k}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </li>
              ))}
            </ul>
        </div>
      );
      case "galeria": return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Galería</h3>
              <label className="text-sm text-primary cursor-pointer hover:underline">
                <Plus className="w-4 h-4 inline mr-1" /> Subir imágenes
                <input type="file" accept="image/*" multiple className="hidden" onChange={addGallery} />
              </label>
            </div>
            {lp.gallery.length === 0 && <p className="text-sm text-muted-foreground">Sin imágenes.</p>}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {lp.gallery.map((g, i) => (
                <div key={i} className="relative group">
                  <img src={g.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                  <button onClick={() => removeGallery(i)} className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
        </div>
      );
      case "whatsapp": return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Abre wa.me con el mensaje ya escrito. Se añade una referencia automática para saber
              qué conversación de WhatsApp vino de esta landing.
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Número (con código de país)</Label>
                <Input
                  placeholder="+56 9 1234 5678"
                  value={lp.whatsapp_number ?? ""}
                  onChange={e => update({ whatsapp_number: e.target.value })}
                  maxLength={30}
                />
              </div>
              <div>
                <Label className="text-xs">Texto del botón</Label>
                <Input
                  placeholder="Escríbenos por WhatsApp"
                  value={lp.whatsapp_cta_text ?? ""}
                  onChange={e => update({ whatsapp_cta_text: e.target.value })}
                  maxLength={60}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensaje prellenado</Label>
              <Textarea
                rows={2}
                placeholder="Hola, vengo desde su página web y quiero más información."
                value={lp.whatsapp_message ?? ""}
                onChange={e => update({ whatsapp_message: e.target.value })}
                maxLength={400}
              />
            </div>
            <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground whitespace-pre-line">
              {landingWhatsappText(lp as any)}
            </div>
        </div>
      );
      case "testimonios": return (
        <div className="space-y-3">
            {lp.testimonials.length === 0 && <p className="text-sm text-muted-foreground">Sin testimonios.</p>}
            <ul className="space-y-2">
              {lp.testimonials.map((t, i) => (
                <li key={i} className="rounded-xl border bg-background p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Nombre" value={t.name} onChange={e => updTestimonial(i, { name: e.target.value })} maxLength={80} />
                    <Input placeholder="Cargo (opcional)" value={t.role ?? ""} onChange={e => updTestimonial(i, { role: e.target.value })} maxLength={80} />
                    <Button size="icon" variant="ghost" onClick={() => update({ testimonials: lp.testimonials.filter((_, k) => k !== i) })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <Textarea placeholder="Testimonio" rows={2} value={t.quote} onChange={e => updTestimonial(i, { quote: e.target.value })} maxLength={400} />
                  <div className="flex items-center gap-3">
                    {t.photo_url && <img src={t.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />}
                    <label className="text-sm text-primary cursor-pointer hover:underline">
                      {t.photo_url ? "Cambiar foto" : "Subir foto (opcional)"}
                      <input type="file" accept="image/*" className="hidden" onChange={e => uploadTestimonialPhoto(i, e)} />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={() => update({ testimonials: [...lp.testimonials, { name: "", quote: "" }] })}>
              <Plus className="w-4 h-4 mr-1" /> Añadir testimonio
            </Button>
        </div>
      );
      case "ubicacion": return (
        <div className="space-y-3">
            <Input placeholder="Dirección" value={lp.location.address ?? ""} onChange={e => update({ location: { ...lp.location, address: e.target.value } })} maxLength={200} />
            <div>
              <Label className="text-xs">URL de mapa incrustado (Google Maps → Compartir → Insertar)</Label>
              <Input
                placeholder="https://www.google.com/maps/embed?..."
                value={lp.location.map_embed_url ?? ""}
                onChange={e => update({ location: { ...lp.location, map_embed_url: e.target.value } })}
                maxLength={800}
              />
            </div>
            <ul className="space-y-2">
              {(lp.location.hours ?? defaultHours()).map((h, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] sm:flex sm:items-center gap-2 text-sm">
                  <span className="w-24 shrink-0">{WEEKDAYS[h.day]}</span>
                  <Label className="flex items-center gap-2 text-xs">
                    <Switch checked={!h.closed} onCheckedChange={v => updHour(i, { closed: !v })} />
                    {h.closed ? "Cerrado" : "Abierto"}
                  </Label>
                  {!h.closed && (
                    <div className="flex items-center gap-2">
                      <Input type="time" step={1800} value={h.from ?? "09:00"} onChange={e => updHour(i, { from: e.target.value })} className="h-8 w-28" />
                      <span className="text-muted-foreground">–</span>
                      <Input type="time" step={1800} value={h.to ?? "18:00"} onChange={e => updHour(i, { to: e.target.value })} className="h-8 w-28" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
        </div>
      );
      case "faq": return (
        <div className="space-y-3">
            {lp.faq.length === 0 && <p className="text-sm text-muted-foreground">Sin preguntas.</p>}
            <ul className="space-y-2">
              {lp.faq.map((f, i) => (
                <li key={i} className="rounded-xl border bg-background p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Pregunta" value={f.question} onChange={e => updFaq(i, { question: e.target.value })} maxLength={160} />
                    <Button size="icon" variant="ghost" onClick={() => update({ faq: lp.faq.filter((_, k) => k !== i) })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <Textarea placeholder="Respuesta" rows={2} value={f.answer} onChange={e => updFaq(i, { answer: e.target.value })} maxLength={800} />
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={() => update({ faq: [...lp.faq, { question: "", answer: "" }] })}>
              <Plus className="w-4 h-4 mr-1" /> Añadir pregunta
            </Button>
        </div>
      );
    }
  }

}

/** Applies defaults so landings created before the new fields keep rendering. */
function normalize(row: any): Landing {
  const location = asObject<LandingLocation>(row.location);
  return {
    ...row,
    services: asArray<Service>(row.services),
    gallery: asArray<GalleryItem>(row.gallery),
    template: (row.template ?? "classic") as LandingTemplate,
    dark_mode: !!row.dark_mode,
    hero_aspect: (row.hero_aspect ?? "square") as HeroAspect,
    testimonials_enabled: !!row.testimonials_enabled,
    testimonials: asArray<Testimonial>(row.testimonials),
    location_enabled: !!row.location_enabled,
    location: { ...location, hours: location.hours?.length ? location.hours : defaultHours() },
    faq_enabled: !!row.faq_enabled,
    faq: asArray<FaqItem>(row.faq),
    footer: asObject<LandingFooter>(row.footer),
    section_order: resolveSectionOrder(row.section_order),
  } as Landing;
}

function LandingPreview({ lp, compact }: { lp: Landing; compact: boolean }) {

  return <PublicLandingView lp={lp as any} preview compact={compact} />;
}


function RowShell({ title, summary, active, disabled, open, onToggle, switchEl, dragHandle, children, style, innerRef }: {
  title: string; summary: string; active: boolean; disabled?: boolean; open: boolean;
  onToggle: () => void; switchEl?: React.ReactNode; dragHandle?: React.ReactNode;
  children: React.ReactNode; style?: React.CSSProperties; innerRef?: (el: HTMLElement | null) => void;
}) {
  return (
    <section ref={innerRef} style={style} className={`rounded-2xl border bg-surface ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 px-4 py-3">
        {dragHandle}
        <button
          type="button"
          onClick={() => { if (!disabled) onToggle(); }}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          <span className="font-medium truncate">{title}</span>
          <span className="text-xs text-muted-foreground truncate">{summary}</span>
          {!disabled && <ChevronDown className={`w-4 h-4 ml-auto shrink-0 transition ${open ? "rotate-180" : ""}`} />}
        </button>
        {switchEl}
      </div>
      {open && !disabled && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function EditorRow(props: { id: string } & React.ComponentProps<typeof RowShell>) {
  const { id, ...rest } = props;
  return <RowShell {...rest} />;
}

function SortableRow({ id, ...rest }: { id: string } & React.ComponentProps<typeof RowShell>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <RowShell
      {...rest}
      innerRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      dragHandle={
        <button type="button" {...attributes} {...listeners} className="text-muted-foreground hover:text-foreground cursor-grab" aria-label="Reordenar">
          <GripVertical className="w-4 h-4" />
        </button>
      }
    />
  );
}
