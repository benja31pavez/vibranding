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
import { Plus, Trash2, ExternalLink, Copy, Eye, GripVertical, Link2 } from "lucide-react";
import type { IGProfile } from "@/components/InstagramEditor";

export const Route = createFileRoute("/_app/clients/$clientId/multilink")({
  component: MultilinkPage,
});

type Multilink = {
  id: string;
  client_id: string;
  slug: string;
  title: string;
  bio: string | null;
  avatar_url: string | null;
  theme_color: string;
  theme_mode: string;
  published: boolean;
  view_count: number;
};

type Item = {
  id: string;
  multilink_id: string;
  client_id: string;
  title: string;
  url: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  click_count: number;
};

function MultilinkPage() {
  const { clientId } = Route.useParams();
  const { client } = useActiveClient();
  const [ml, setMl] = useState<Multilink | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [igProfile, setIgProfile] = useState<IGProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: ig }] = await Promise.all([
      supabase.from("multilinks").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("instagram_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    ]);
    setMl(m as Multilink | null);
    setIgProfile((ig ?? null) as IGProfile | null);
    if (m) {
      const { data: it } = await supabase
        .from("multilink_items").select("*")
        .eq("multilink_id", m.id).order("sort_order");
      setItems((it ?? []) as Item[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const defaultAvatarUrl = igProfile?.proposed_avatar_url ?? igProfile?.current_avatar_url ?? null;
  const effectiveAvatarUrl = ml?.avatar_url ?? defaultAvatarUrl;

  const createMultilink = async () => {
    if (!client) return;
    const base = client.instagram_handle || slugify(client.name);
    const slug = await uniqueSlug("multilinks", base);
    const { data, error } = await supabase.from("multilinks").insert({
      client_id: clientId,
      slug,
      title: client.name,
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setMl(data as Multilink);
    toast.success("Multienlace creado");
  };

  const updateMl = async (patch: Partial<Multilink>) => {
    if (!ml) return;
    setMl({ ...ml, ...patch });
  };

  const persistMl = async () => {
    if (!ml) return;
    setSaving(true);
    const { error } = await supabase.from("multilinks").update({
      title: ml.title,
      bio: ml.bio,
      avatar_url: ml.avatar_url,
      theme_color: ml.theme_color,
      theme_mode: ml.theme_mode,
      slug: slugify(ml.slug) || ml.slug,
    }).eq("id", ml.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
  };

  const togglePublished = async () => {
    if (!ml) return;
    const { error } = await supabase.from("multilinks")
      .update({ published: !ml.published }).eq("id", ml.id);
    if (error) return toast.error(error.message);
    setMl({ ...ml, published: !ml.published });
  };

  const addItem = async () => {
    if (!ml) return;
    const { data, error } = await supabase.from("multilink_items").insert({
      multilink_id: ml.id,
      client_id: clientId,
      title: "Nuevo enlace",
      url: "https://",
      sort_order: items.length,
    }).select("*").single();
    if (error) return toast.error(error.message);
    setItems([...items, data as Item]);
  };

  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const persistItem = async (i: Item) => {
    const { error } = await supabase.from("multilink_items").update({
      title: i.title, url: i.url, icon: i.icon, is_active: i.is_active,
    }).eq("id", i.id);
    if (error) toast.error(error.message);
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("multilink_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems(items.filter(i => i.id !== id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex(i => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await Promise.all(next.map((it, k) =>
      supabase.from("multilink_items").update({ sort_order: k }).eq("id", it.id)
    ));
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !ml) return;
    try {
      const url = await uploadClientMedia(f, clientId);
      setMl({ ...ml, avatar_url: url });
      await supabase.from("multilinks").update({ avatar_url: url }).eq("id", ml.id);
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="p-10 text-muted-foreground">Cargando…</div>;

  if (!ml) {
    return (
      <div className="rounded-3xl border bg-surface p-10 text-center max-w-xl mx-auto">
        <Link2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-xl font-semibold mb-2">Multienlace</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Crea una página estilo Linktree con todos los enlaces importantes de {client?.name}.
        </p>
        <Button onClick={createMultilink}><Plus className="w-4 h-4 mr-1" /> Crear multienlace</Button>
      </div>
    );
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/@${ml.slug}/links`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Multienlace</h1>
          <p className="text-sm text-muted-foreground">Edita los enlaces y el tema. Publica cuando esté listo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-2 text-sm">
            <Switch checked={ml.published} onCheckedChange={togglePublished} />
            {ml.published ? "Publicado" : "Borrador"}
          </Label>
          <Button variant="outline" size="sm" asChild>
            <Link to="/@{$slug}/links" params={{ slug: ml.slug }} target="_blank">
              <Eye className="w-4 h-4 mr-1" /> Vista previa
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-surface p-5 flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted-foreground">URL pública:</div>
        <code className="text-sm bg-secondary px-2 py-1 rounded">{publicUrl}</code>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copiado"); }}>
          <Copy className="w-3.5 h-3.5" />
        </Button>
        {ml.published && (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-1 text-primary hover:underline">
            Abrir <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <div className="ml-auto text-xs text-muted-foreground">{ml.view_count} visitas</div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-surface p-5 space-y-3">
            <h3 className="font-medium text-sm">Perfil</h3>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-secondary overflow-hidden grid place-items-center text-xl font-semibold">
                {ml.avatar_url ? <img src={ml.avatar_url} alt="" className="w-full h-full object-cover" /> : (ml.title[0] || "?")}
              </div>
              <label className="text-sm text-primary cursor-pointer hover:underline">
                Cambiar avatar
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
              </label>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={ml.title} onChange={e => updateMl({ title: e.target.value })} maxLength={80} />
            </div>
            <div>
              <Label className="text-xs">Bio</Label>
              <Textarea value={ml.bio ?? ""} onChange={e => updateMl({ bio: e.target.value })} rows={3} maxLength={200} />
            </div>
            <div>
              <Label className="text-xs">Slug (URL)</Label>
              <Input value={ml.slug} onChange={e => updateMl({ slug: e.target.value })} />
            </div>
            <div className="flex gap-3 items-center">
              <div>
                <Label className="text-xs">Color</Label>
                <Input type="color" value={ml.theme_color} onChange={e => updateMl({ theme_color: e.target.value })} className="w-20 h-9 p-1" />
              </div>
              <div>
                <Label className="text-xs">Modo</Label>
                <select className="block h-9 rounded-md border bg-background px-3 text-sm"
                  value={ml.theme_mode}
                  onChange={e => updateMl({ theme_mode: e.target.value })}>
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </select>
              </div>
            </div>
            <Button onClick={persistMl} disabled={saving}>Guardar cambios</Button>
          </div>

          <div className="rounded-2xl border bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Enlaces</h3>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Añadir</Button>
            </div>
            {items.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay enlaces.</p>}
            <ul className="space-y-2">
              {items.map((i, idx) => (
                <li key={i.id} className="rounded-xl border p-3 space-y-2 bg-background">
                  <div className="flex gap-2 items-center">
                    <div className="flex flex-col">
                      <button onClick={() => move(i.id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">▲</button>
                      <button onClick={() => move(i.id, 1)} disabled={idx === items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">▼</button>
                    </div>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Título"
                      value={i.title}
                      onChange={e => updateItem(i.id, { title: e.target.value })}
                      onBlur={() => persistItem(i)}
                      maxLength={80}
                    />
                    <Switch checked={i.is_active} onCheckedChange={(v) => { updateItem(i.id, { is_active: v }); persistItem({ ...i, is_active: v }); }} />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <Input
                    placeholder="https://..."
                    value={i.url}
                    onChange={e => updateItem(i.id, { url: e.target.value })}
                    onBlur={() => persistItem(i)}
                    maxLength={500}
                  />
                  <div className="text-xs text-muted-foreground">{i.click_count} clics</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Preview */}
        <div className="md:sticky md:top-20 h-fit">
          <div className="text-xs text-muted-foreground mb-2 text-center">Vista previa</div>
          <div className="mx-auto" style={{ width: 320 }}>
            <div className="relative rounded-[3rem] bg-black p-2 shadow-2xl">
              <div
                className="relative rounded-[2.5rem] overflow-hidden"
                style={{
                  aspectRatio: "9/19.5",
                  background: ml.theme_mode === "dark" ? "#0a0a0a" : "#fafafa",
                  color: ml.theme_mode === "dark" ? "#fafafa" : "#0a0a0a",
                }}
              >
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-30" />
                <div className="absolute inset-0 flex flex-col pt-10 px-5 pb-6 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-black/10 mx-auto overflow-hidden grid place-items-center text-2xl font-semibold">
                      {ml.avatar_url
                        ? <img src={ml.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (ml.title[0] || "?")}
                    </div>
                    <h2 className="mt-3 font-semibold text-lg">{ml.title || "Título"}</h2>
                    {ml.bio && <p className="mt-1 text-sm opacity-80 whitespace-pre-line">{ml.bio}</p>}
                  </div>
                  <div className="mt-6 space-y-3">
                    {items.filter(i => i.is_active).map(i => (
                      <div key={i.id}
                        className="rounded-xl py-3 px-4 text-center text-sm font-medium"
                        style={{ background: ml.theme_color, color: "#fff" }}>
                        {i.title || "Enlace"}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
