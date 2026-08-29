import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Plus, Trash2, ExternalLink, Copy, Eye, Globe, Mail, Smartphone, Monitor, MessageCircle } from "lucide-react";
import { EventsPanel } from "@/components/landing/EventsPanel";
import { landingWhatsappText } from "@/lib/landingWhatsapp";


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
};

type Submission = { id: string; name: string; email: string; phone: string | null; message: string; created_at: string };

export function LandingEditor({ clientId }: { clientId: string }) {
  const { client } = useActiveClient();
  const [lp, setLp] = useState<Landing | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("landing_pages").select("*").eq("client_id", clientId).maybeSingle();
    setLp(data as unknown as Landing | null);
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
    setLp(data as unknown as Landing);
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
    }).eq("id", lp.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
  };

  const togglePub = async () => {
    if (!lp) return;
    const { error } = await supabase.from("landing_pages").update({ published: !lp.published }).eq("id", lp.id);
    if (error) return toast.error(error.message);
    setLp({ ...lp, published: !lp.published });
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

      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Slug</Label>
              <Input value={lp.slug} onChange={e => update({ slug: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Color principal</Label>
              <Input type="color" value={lp.theme_color} onChange={e => update({ theme_color: e.target.value })} className="h-9 p-1" />
            </div>
          </div>

          {/* Hero */}
          <section className="rounded-2xl border bg-surface p-5 space-y-3">
            <h3 className="font-medium">Hero</h3>
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
          </section>

          {/* Services */}
          <section className="rounded-2xl border bg-surface p-5 space-y-3">
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
                </li>
              ))}
            </ul>
          </section>

          {/* Gallery */}
          <section className="rounded-2xl border bg-surface p-5 space-y-3">
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
          </section>

          {/* WhatsApp CTA */}
          <section className="rounded-2xl border bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Bloque de WhatsApp
              </h3>
              <Switch
                checked={lp.whatsapp_enabled}
                onCheckedChange={v => update({ whatsapp_enabled: v })}
              />
            </div>
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
          </section>

          <EventsPanel clientId={clientId} sourceType="landing" sourceId={lp.id} />

          {/* Contact */}
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
                  <div className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  <div className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
    </div>
  );
}

function LandingPreview({ lp, compact }: { lp: Landing; compact: boolean }) {
  const color = lp.theme_color || "#6366f1";
  return (
    <div className="bg-white text-gray-900">
      {/* Hero */}
      <section className={compact ? "px-4 py-6" : "px-6 py-10"}>
        <div className={compact ? "" : "grid grid-cols-2 gap-6 items-center"}>
          <div>
            <h1 className={compact ? "text-lg font-bold leading-tight" : "text-2xl font-bold leading-tight"} style={{ color }}>
              {lp.hero_title || "Título"}
            </h1>
            {lp.hero_subtitle && (
              <p className={compact ? "mt-2 text-[11px] text-gray-600 whitespace-pre-line" : "mt-2 text-xs text-gray-600 whitespace-pre-line"}>
                {lp.hero_subtitle}
              </p>
            )}
            {lp.cta_text && (
              <div
                className={compact ? "inline-block mt-3 rounded-full px-3 py-1.5 text-[10px] font-medium text-white" : "inline-block mt-3 rounded-full px-4 py-2 text-xs font-medium text-white"}
                style={{ background: color }}
              >
                {lp.cta_text}
              </div>
            )}
          </div>
          {lp.hero_image_url && !compact && (
            <img src={lp.hero_image_url} alt="" className="w-full rounded-xl object-cover aspect-square" />
          )}
        </div>
        {lp.hero_image_url && compact && (
          <img src={lp.hero_image_url} alt="" className="w-full rounded-xl object-cover aspect-square mt-4" />
        )}
      </section>

      {/* Services */}
      {lp.services?.length > 0 && (
        <section className={compact ? "bg-gray-50 px-4 py-6" : "bg-gray-50 px-6 py-8"}>
          <h2 className={compact ? "text-sm font-bold text-center mb-3" : "text-lg font-bold text-center mb-4"}>Servicios</h2>
          <div className={compact ? "space-y-2" : "grid grid-cols-3 gap-3"}>
            {lp.services.map((s, i) => (
              <div key={i} className="rounded-xl bg-white p-3 shadow-sm border">
                <div className="w-6 h-6 rounded-md mb-2" style={{ background: `${color}22` }} />
                <h3 className="font-semibold text-xs" style={{ color }}>{s.title}</h3>
                <p className="mt-1 text-[10px] text-gray-600 line-clamp-3 whitespace-pre-line">{s.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {lp.gallery?.length > 0 && (
        <section className={compact ? "px-4 py-6" : "px-6 py-8"}>
          <h2 className={compact ? "text-sm font-bold text-center mb-3" : "text-lg font-bold text-center mb-4"}>Galería</h2>
          <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
            {lp.gallery.map((g, i) => (
              <img key={i} src={g.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {lp.contact_enabled && (
        <section className={compact ? "bg-gray-50 px-4 py-6" : "bg-gray-50 px-6 py-8"}>
          <h2 className={compact ? "text-sm font-bold text-center mb-2" : "text-lg font-bold text-center mb-2"}>Contáctanos</h2>
          <div className="rounded-xl bg-white p-3 border space-y-2">
            <div className="h-6 rounded border bg-gray-50" />
            <div className="h-6 rounded border bg-gray-50" />
            <div className="h-12 rounded border bg-gray-50" />
            <div className="h-7 rounded text-white text-[10px] grid place-items-center" style={{ background: color }}>Enviar mensaje</div>
          </div>
        </section>
      )}

      <footer className="py-3 text-center text-[9px] text-gray-500">
        © {new Date().getFullYear()} {lp.hero_title}
      </footer>
    </div>
  );
}
