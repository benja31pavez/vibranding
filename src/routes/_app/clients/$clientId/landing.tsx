import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Trash2, ExternalLink, Copy, Eye, Globe, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/clients/$clientId/landing")({
  component: LandingEditor,
});

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
};

type Submission = { id: string; name: string; email: string; message: string; created_at: string };

function LandingEditor() {
  const { clientId } = Route.useParams();
  const { client } = useActiveClient();
  const [lp, setLp] = useState<Landing | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("landing_pages").select("*").eq("client_id", clientId).maybeSingle();
    setLp(data as Landing | null);
    if (data) {
      const { data: s } = await supabase.from("landing_contact_submissions")
        .select("id,name,email,message,created_at")
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
    setLp(data as Landing);
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

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${lp.slug}`;

  return (
    <div className="space-y-6 max-w-5xl">
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
          <Button variant="outline" size="sm" asChild>
            <Link to="/p/$slug" params={{ slug: lp.slug }} target="_blank">
              <Eye className="w-4 h-4 mr-1" /> Vista previa
            </Link>
          </Button>
          <Button onClick={save} disabled={saving}>Guardar</Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-surface p-5 flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted-foreground">URL pública:</div>
        <code className="text-sm bg-secondary px-2 py-1 rounded">{publicUrl}</code>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copiado"); }}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
        {lp.published && (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-1 text-primary hover:underline">
            Abrir <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <div className="ml-auto text-xs text-muted-foreground">{lp.view_count} visitas</div>
      </div>

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
                  <div className="font-medium">{s.name} <span className="text-muted-foreground font-normal">· {s.email}</span></div>
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
  );
}
