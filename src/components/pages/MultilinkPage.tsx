import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EventsPanel } from "@/components/landing/EventsPanel";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { uniqueSlug, slugify } from "@/lib/slug";
import { uploadClientMedia } from "@/lib/uploadMedia";
import {
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Eye,
  GripVertical,
  Link2,
  Globe,
  Star,
  CalendarClock,
  Palette,
  Upload,
  Activity,
  ChevronDown,
} from "lucide-react";
import { MultilinkAnalytics } from "@/components/multilink/MultilinkAnalytics";
import { QrCodeCard } from "@/components/multilink/QrCodeCard";
import { PublicMultilinkView } from "@/components/multilink/PublicMultilinkView";
import {
  KIND_LABEL,
  multilinkPath,
  multilinkPublicUrl,
  scheduleState,
  SOCIAL_LABEL,
  type Multilink,
  type MultilinkItem as Item,
  type MultilinkItemKind,
  type SocialNetwork,
} from "@/lib/multilink";
import {
  BUTTON_SHAPE_LABEL,
  BUTTON_STYLE_LABEL,
  FONTS,
  parseBackground,
  type Background,
  type ButtonShape,
  type ButtonStyle,
  type FontKey,
} from "@/lib/multilinkTheme";
import type { IGProfile } from "@/components/InstagramEditor";

type TabKey = "diseno" | "enlaces" | "config" | "metricas";

export function MultilinkPage({ clientId }: { clientId: string }) {
  const { client } = useActiveClient();
  const [ml, setMl] = useState<Multilink | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [igProfile, setIgProfile] = useState<IGProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile");
  const [tab, setTab] = useState<TabKey>("diseno");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: ig }] = await Promise.all([
      supabase.from("multilinks").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("instagram_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    ]);
    const igP = (ig ?? null) as IGProfile | null;
    setIgProfile(igP);

    let multilink = m as Multilink | null;
    if (multilink && !multilink.avatar_url) {
      const igAvatar = igP?.proposed_avatar_url ?? igP?.current_avatar_url ?? null;
      if (igAvatar) {
        await supabase.from("multilinks").update({ avatar_url: igAvatar }).eq("id", multilink.id);
        multilink = { ...multilink, avatar_url: igAvatar };
      }
    }
    setMl(multilink);

    if (multilink) {
      const { data: it } = await supabase
        .from("multilink_items")
        .select("*")
        .eq("multilink_id", multilink.id)
        .order("sort_order");
      setItems((it ?? []) as Item[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [clientId]);

  const defaultAvatarUrl = igProfile?.proposed_avatar_url ?? igProfile?.current_avatar_url ?? null;
  const effectiveAvatarUrl = ml?.avatar_url ?? defaultAvatarUrl;

  const createMultilink = async () => {
    if (!client) return;
    const base = client.instagram_handle || slugify(client.name);
    const slug = await uniqueSlug("multilinks", base);
    const igAvatar = igProfile?.proposed_avatar_url ?? igProfile?.current_avatar_url ?? null;
    const { data, error } = await supabase
      .from("multilinks")
      .insert({
        client_id: clientId,
        slug,
        title: client.name,
        avatar_url: igAvatar,
      })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
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
    const { error } = await supabase
      .from("multilinks")
      .update({
        custom_domain:
          ml.custom_domain
            ?.trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "") || null,
        title: ml.title,
        bio: ml.bio,
        avatar_url: ml.avatar_url,
        theme_color: ml.theme_color,
        theme_mode: ml.theme_mode,
        button_style: ml.button_style,
        button_shape: ml.button_shape,
        font_family: ml.font_family,
        background: ml.background as any,
        slug: slugify(ml.slug) || ml.slug,
      })
      .eq("id", ml.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
  };

  const togglePublished = async () => {
    if (!ml) return;
    const { error } = await supabase.from("multilinks").update({ published: !ml.published }).eq("id", ml.id);
    if (error) return toast.error(error.message);
    setMl({ ...ml, published: !ml.published });
  };

  const addItem = async () => {
    if (!ml) return;
    const { data, error } = await supabase
      .from("multilink_items")
      .insert({
        multilink_id: ml.id,
        client_id: clientId,
        title: "Nuevo enlace",
        url: "https://",
        kind: "link",
        sort_order: items.length,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setItems([...items, data as Item]);
  };

  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const persistItem = async (i: Item) => {
    const { error } = await supabase
      .from("multilink_items")
      .update({
        title: i.title,
        url: i.url,
        icon: i.icon,
        is_active: i.is_active,
        kind: i.kind,
        featured: i.featured,
        subtitle: i.subtitle,
        thumbnail_url: i.thumbnail_url,
        wa_number: i.wa_number,
        wa_message: i.wa_message,
        video_url: i.video_url,
        start_at: i.start_at,
        end_at: i.end_at,
      })
      .eq("id", i.id);
    if (error) toast.error(error.message);
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("multilink_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems(items.filter((i) => i.id !== id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await Promise.all(next.map((it, k) => supabase.from("multilink_items").update({ sort_order: k }).eq("id", it.id)));
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !ml) return;
    try {
      const url = await uploadClientMedia(f, clientId);
      setMl({ ...ml, avatar_url: url });
      await supabase.from("multilinks").update({ avatar_url: url }).eq("id", ml.id);
    } catch (err: any) {
      toast.error(err.message);
    }
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
        <Button onClick={createMultilink}>
          <Plus className="w-4 h-4 mr-1" /> Crear multienlace
        </Button>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = multilinkPublicUrl(ml, origin);
  const appUrl = `${origin}${multilinkPath(ml.slug)}`;
  const bg = parseBackground(ml.background);
  const setBg = (next: Background) => updateMl({ background: next });
  // The preview renders the real public page, so it can never drift from it.
  const previewMl: Multilink = { ...ml, avatar_url: effectiveAvatarUrl };

  const onBackgroundImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await uploadClientMedia(f, clientId);
      setBg({ type: "image", url, overlay: bg.type === "image" ? bg.overlay : 0.45 });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
            <Link to="/l/$slug" params={{ slug: ml.slug }} target="_blank">
              <Eye className="w-4 h-4 mr-1" /> Vista previa
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-5">
        <TabsList>
          <TabsTrigger value="diseno">Diseño</TabsTrigger>
          <TabsTrigger value="enlaces">Enlaces</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="diseno" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="space-y-4">
              <SettingsSection title="Perfil" defaultOpen>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-secondary overflow-hidden grid place-items-center text-xl font-semibold">
                    {effectiveAvatarUrl ? (
                      <img src={effectiveAvatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      ml.title[0] || "?"
                    )}
                  </div>
                  <label className="text-sm text-primary cursor-pointer hover:underline">
                    Cambiar avatar
                    <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
                  </label>
                </div>
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={ml.title} onChange={(e) => updateMl({ title: e.target.value })} maxLength={80} />
                </div>
                <div>
                  <Label className="text-xs">Bio</Label>
                  <Textarea
                    value={ml.bio ?? ""}
                    onChange={(e) => updateMl({ bio: e.target.value })}
                    rows={3}
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label className="text-xs">Slug (URL)</Label>
                  <Input value={ml.slug} onChange={(e) => updateMl({ slug: e.target.value })} />
                </div>
                <div className="flex gap-3 items-center">
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input
                      type="color"
                      value={ml.theme_color}
                      onChange={(e) => updateMl({ theme_color: e.target.value })}
                      className="w-20 h-9 p-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Modo</Label>
                    <select
                      className="block h-9 rounded-md border bg-background px-3 text-sm"
                      value={ml.theme_mode}
                      onChange={(e) => updateMl({ theme_mode: e.target.value })}
                    >
                      <option value="light">Claro</option>
                      <option value="dark">Oscuro</option>
                    </select>
                  </div>
                </div>
                <Button onClick={persistMl} disabled={saving}>
                  Guardar cambios
                </Button>
              </SettingsSection>

              <SettingsSection
                title="Estilo"
                icon={<Palette className="w-4 h-4" />}
                summary="Botones, tipografía y fondo"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Estilo de botón</Label>
                    <select
                      className="block w-full h-9 rounded-md border bg-background px-2 text-sm"
                      value={ml.button_style}
                      onChange={(e) => updateMl({ button_style: e.target.value as ButtonStyle })}
                    >
                      {(Object.keys(BUTTON_STYLE_LABEL) as ButtonStyle[]).map((k) => (
                        <option key={k} value={k}>
                          {BUTTON_STYLE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Forma</Label>
                    <select
                      className="block w-full h-9 rounded-md border bg-background px-2 text-sm"
                      value={ml.button_shape}
                      onChange={(e) => updateMl({ button_shape: e.target.value as ButtonShape })}
                    >
                      {(Object.keys(BUTTON_SHAPE_LABEL) as ButtonShape[]).map((k) => (
                        <option key={k} value={k}>
                          {BUTTON_SHAPE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Tipografía</Label>
                  <select
                    className="block w-full h-9 rounded-md border bg-background px-2 text-sm"
                    value={ml.font_family}
                    onChange={(e) => updateMl({ font_family: e.target.value as FontKey })}
                  >
                    {(Object.keys(FONTS) as FontKey[]).map((k) => (
                      <option key={k} value={k}>
                        {FONTS[k].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs">Fondo</Label>
                  <select
                    className="block w-full h-9 rounded-md border bg-background px-2 text-sm"
                    value={bg.type}
                    onChange={(e) => {
                      const t = e.target.value as Background["type"];
                      if (t === "flat") setBg({ type: "flat" });
                      else if (t === "solid") setBg({ type: "solid", color: "#111827" });
                      else if (t === "gradient")
                        setBg({ type: "gradient", from: "#6d28d9", to: "#db2777", angle: 160 });
                      else setBg({ type: "image", url: null, overlay: 0.45 });
                    }}
                  >
                    <option value="flat">Según modo claro/oscuro</option>
                    <option value="solid">Color sólido</option>
                    <option value="gradient">Degradado</option>
                    <option value="image">Imagen</option>
                  </select>

                  {bg.type === "solid" && (
                    <Input
                      type="color"
                      value={bg.color}
                      onChange={(e) => setBg({ ...bg, color: e.target.value })}
                      className="w-20 h-9 p-1"
                    />
                  )}

                  {bg.type === "gradient" && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Desde</Label>
                        <Input
                          type="color"
                          value={bg.from}
                          onChange={(e) => setBg({ ...bg, from: e.target.value })}
                          className="w-16 h-9 p-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Hasta</Label>
                        <Input
                          type="color"
                          value={bg.to}
                          onChange={(e) => setBg({ ...bg, to: e.target.value })}
                          className="w-16 h-9 p-1"
                        />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-[11px] text-muted-foreground">Ángulo: {bg.angle}°</Label>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={5}
                          value={bg.angle}
                          onChange={(e) => setBg({ ...bg, angle: Number(e.target.value) })}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                  )}

                  {bg.type === "image" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-14 rounded-lg bg-secondary overflow-hidden grid place-items-center">
                          {bg.url ? (
                            <img src={bg.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <label className="text-sm text-primary cursor-pointer hover:underline">
                          Subir imagen
                          <input type="file" accept="image/*" className="hidden" onChange={onBackgroundImage} />
                        </label>
                      </div>
                      <Label className="text-[11px] text-muted-foreground">
                        Oscurecer para legibilidad: {Math.round(bg.overlay * 100)}%
                      </Label>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        step={5}
                        value={Math.round(bg.overlay * 100)}
                        onChange={(e) => setBg({ ...bg, overlay: Number(e.target.value) / 100 })}
                        className="w-full accent-primary"
                      />
                    </div>
                  )}
                </div>

                <Button onClick={persistMl} disabled={saving}>
                  Guardar estilo
                </Button>
              </SettingsSection>

            </div>

            {/* Preview */}
            <div className="md:sticky md:top-20 h-fit space-y-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode("mobile")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${previewMode === "mobile" ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  Móvil
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("desktop")}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${previewMode === "desktop" ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  Escritorio
                </button>
              </div>

              {previewMode === "mobile" ? (
                <div className="mx-auto w-[320px] sm:w-[360px] h-[640px] rounded-[3rem] bg-foreground p-2 shadow-2xl overflow-hidden">
                  <div className="relative h-full rounded-[2.5rem] bg-background overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-6 flex justify-center items-end pb-1 z-10 pointer-events-none">
                      <div className="w-24 h-4 rounded-full bg-foreground" />
                    </div>
                    <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-6">
                      <PublicMultilinkView ml={previewMl} items={items} preview />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[640px]">
                  <div className="rounded-t-2xl bg-foreground p-2 pb-0 shadow-xl">
                    <div className="rounded-t-xl bg-background h-[420px] overflow-hidden">
                      <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <PublicMultilinkView ml={previewMl} items={items} preview />
                      </div>
                    </div>
                  </div>
                  <div className="mx-auto w-24 h-3 bg-foreground/80 rounded-b-sm" />
                  <div className="mx-auto w-40 h-5 bg-foreground rounded-b-xl shadow-lg" />
                  <div className="mx-auto mt-1 w-56 h-1.5 bg-foreground/60 rounded-full" />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="enlaces" className="space-y-6">
          <div className="max-w-3xl">
              <SettingsSection
                title="Enlaces"
                defaultOpen
                action={
                  <Button size="sm" variant="outline" onClick={addItem}>
                    <Plus className="w-4 h-4 mr-1" /> Añadir
                  </Button>
                }
              >
                {items.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay enlaces.</p>}
                <ul className="space-y-2">
                  {items.map((i, idx) => {
                    const expanded = expandedId === i.id;
                    return (
                      <li key={i.id} className="rounded-xl border bg-background overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="flex flex-col">
                            <button
                              onClick={() => move(i.id, -1)}
                              disabled={idx === 0}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => move(i.id, 1)}
                              disabled={idx === items.length - 1}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                            >
                              ▼
                            </button>
                          </div>
                          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : i.id)}
                            aria-expanded={expanded}
                            className="flex-1 min-w-0 flex items-center gap-2 text-left"
                          >
                            <span className="font-medium text-sm truncate">
                              {i.title.trim() || "Nuevo enlace"}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {KIND_LABEL[i.kind]}
                            </span>
                            <ScheduleBadge item={i} />
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </button>
                          <Switch
                            checked={i.is_active}
                            onCheckedChange={(v) => {
                              updateItem(i.id, { is_active: v });
                              persistItem({ ...i, is_active: v });
                            }}
                          />
                          <Button size="icon" variant="ghost" onClick={() => removeItem(i.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {expanded && (
                          <div className="px-3 pb-3 space-y-2 border-t bg-surface/30">
                            <div className="pt-2">
                              <Input
                                placeholder="Título"
                                value={i.title}
                                onChange={(e) => updateItem(i.id, { title: e.target.value })}
                                onBlur={() => persistItem(i)}
                                maxLength={80}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                                value={i.kind}
                                onChange={(e) => {
                                  const kind = e.target.value as MultilinkItemKind;
                                  updateItem(i.id, { kind });
                                persistItem({ ...i, kind });
                                }}
                              >
                                <optgroup label="Enlaces">
                                  <option value="link">{KIND_LABEL.link}</option>
                                  <option value="whatsapp">{KIND_LABEL.whatsapp}</option>
                                  <option value="video">{KIND_LABEL.video}</option>
                                </optgroup>
                                <optgroup label="Redes sociales">
                                  <option value="social">{KIND_LABEL.social}</option>
                                </optgroup>
                                <optgroup label="Plataformas de música">
                                  <option value="platform">{KIND_LABEL.platform}</option>
                                </optgroup>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(i.id, { featured: !i.featured });
                                  persistItem({ ...i, featured: !i.featured });
                                }}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-full border transition ${i.featured ? "bg-foreground text-background border-foreground" : "text-muted-foreground"}`}
                              >
                                <Star className="w-3 h-3" /> Destacado
                              </button>
                            </div>

                            {i.kind === "whatsapp" ? (
                              <div className="grid sm:grid-cols-2 gap-2">
                                <Input
                                  placeholder="+56 9 1234 5678"
                                  value={i.wa_number ?? ""}
                                  onChange={(e) => updateItem(i.id, { wa_number: e.target.value })}
                                  onBlur={() => persistItem(i)}
                                  maxLength={30}
                                />
                                <Input
                                  placeholder="Mensaje prellenado"
                                  value={i.wa_message ?? ""}
                                  onChange={(e) => updateItem(i.id, { wa_message: e.target.value })}
                                  onBlur={() => persistItem(i)}
                                  maxLength={300}
                                />
                              </div>
                            ) : i.kind === "social" || i.kind === "platform" ? (
                              <div className="flex gap-2">
                                <SocialSelect
                                  value={i.icon ?? "instagram"}
                                  kind={i.kind}
                                  onChange={(v) => {
                                    updateItem(i.id, { icon: v });
                                    persistItem({ ...i, icon: v });
                                  }}
                                />
                                <Input
                                  placeholder="@usuario, URL, email o teléfono"
                                  value={i.url}
                                  onChange={(e) => updateItem(i.id, { url: e.target.value })}
                                  onBlur={() => persistItem(i)}
                                  maxLength={500}
                                />
                              </div>
                            ) : i.kind === "video" ? (
                              <Input
                                placeholder="URL de YouTube, Vimeo o .mp4"
                                value={i.video_url ?? ""}
                                onChange={(e) => updateItem(i.id, { video_url: e.target.value })}
                                onBlur={() => persistItem(i)}
                                maxLength={500}
                              />
                            ) : (
                              <Input
                                placeholder="https://..."
                                value={i.url}
                                onChange={(e) => updateItem(i.id, { url: e.target.value })}
                                onBlur={() => persistItem(i)}
                                maxLength={500}
                              />
                            )}

                            <Input
                              placeholder="Subtítulo (opcional)"
                              value={i.subtitle ?? ""}
                              onChange={(e) => updateItem(i.id, { subtitle: e.target.value })}
                              onBlur={() => persistItem(i)}
                              maxLength={120}
                            />

                            <div className="text-xs text-muted-foreground">{i.click_count} clics acumulados</div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </SettingsSection>
          </div>
        </TabsContent>


        <TabsContent value="config" className="space-y-6">
          <SettingsSection title="Publicación" defaultOpen>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <Label className="text-xs">Slug (URL)</Label>
                <Input value={ml.slug} onChange={(e) => updateMl({ slug: e.target.value })} onBlur={persistMl} />
              </div>
              <Label className="flex items-center gap-2 text-sm h-9">
                <Switch checked={ml.published} onCheckedChange={togglePublished} />
                {ml.published ? "Publicado" : "Borrador"}
              </Label>
              <Button onClick={persistMl} disabled={saving}>
                Guardar
              </Button>
            </div>
          </SettingsSection>

          <div className="rounded-2xl border bg-surface p-5 flex flex-wrap items-center gap-3">
            <div className="text-sm text-muted-foreground">URL pública:</div>
            <code className="text-sm bg-secondary px-2 py-1 rounded">{publicUrl}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Copiado");
              }}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {ml.published && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm inline-flex items-center gap-1 text-primary hover:underline"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <div className="ml-auto text-xs text-muted-foreground">{ml.view_count} visitas acumuladas</div>
          </div>

          <SettingsSection
            title="Dominio propio"
            icon={<Globe className="w-4 h-4" />}
            summary="Conecta el dominio del cliente"
          >
            <p className="text-xs text-muted-foreground">
              Apunta el dominio del cliente a esta app con un registro CNAME hacia{" "}
              <code>{origin.replace(/^https?:\/\//, "")}</code> y escríbelo aquí. Mientras no esté verificado, la URL
              pública sigue siendo {appUrl}.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <Label className="text-xs">Dominio (sin https://)</Label>
                <Input
                  placeholder="enlaces.micliente.cl"
                  value={ml.custom_domain ?? ""}
                  onChange={(e) => updateMl({ custom_domain: e.target.value })}
                  onBlur={persistMl}
                />
              </div>
              <div className="text-xs px-2 py-1 rounded-full border">
                {!ml.custom_domain ? "Sin dominio" : ml.custom_domain_verified ? "Verificado" : "Pendiente de DNS"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              URL pública actual: <code>{publicUrl}</code>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Programación de enlaces"
            icon={<CalendarClock className="w-4 h-4" />}
            summary="Desde y hasta cuándo se ve cada enlace"
          >
            <p className="text-xs text-muted-foreground">
              Define desde y hasta cuándo se muestra cada enlace. Vacío significa siempre visible.
            </p>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay enlaces que programar.</p>
            ) : (
              <ul className="space-y-3">
                {items.map((i) => (
                  <li key={i.id} className="rounded-xl border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{i.title}</span>
                      <ScheduleBadge item={i} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Aparece desde</Label>
                        <Input
                          type="datetime-local"
                          value={toLocalInput(i.start_at)}
                          onChange={(e) => updateItem(i.id, { start_at: fromLocalInput(e.target.value) })}
                          onBlur={() => persistItem(i)}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Desaparece el</Label>
                        <Input
                          type="datetime-local"
                          value={toLocalInput(i.end_at)}
                          onChange={(e) => updateItem(i.id, { end_at: fromLocalInput(e.target.value) })}
                          onBlur={() => persistItem(i)}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SettingsSection>

          <QrCodeCard url={publicUrl} fileBase={ml.slug} />
        </TabsContent>

        <TabsContent value="metricas" className="space-y-6">
          {!ml.published ? (
            <div className="rounded-2xl border border-dashed bg-surface p-8 text-center space-y-2">
              <Activity className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="font-medium">Este multienlace no está publicado</p>
              <p className="text-sm text-muted-foreground">
                Todavía no se registran visitas ni clics porque la página no es pública. Publícala en Configuración para
                empezar a medir.
              </p>
            </div>
          ) : (
            <>
              <MultilinkAnalytics clientId={clientId} multilinkId={ml.id} items={items} />
              <EventsPanel
                clientId={clientId}
                sourceType="multilink"
                sourceId={ml.id}
                itemLabels={Object.fromEntries(items.map((i) => [i.id, i.title]))}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function SettingsSection({
  title,
  icon,
  summary,
  action,
  defaultOpen,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  summary?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="rounded-2xl border bg-surface">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          {icon}
          <span className="font-medium truncate">{title}</span>
          {summary && <span className="text-xs text-muted-foreground truncate">{summary}</span>}
          <ChevronDown className={`w-4 h-4 shrink-0 ml-auto transition ${open ? "rotate-180" : ""}`} />
        </button>
        {action}
      </div>
      {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </section>
  );
}

function ScheduleBadge({ item }: { item: Item }) {
  const state = scheduleState(item);
  const map = {
    live: { label: "Visible", className: "text-emerald-600 border-emerald-600/40" },
    scheduled: { label: "Programado", className: "text-amber-600 border-amber-600/40" },
    expired: { label: "Expirado", className: "text-muted-foreground" },
    off: { label: "Desactivado", className: "text-muted-foreground" },
  } as const;
  const s = map[state];
  return <span className={`text-[11px] px-2 py-1 rounded-full border ${s.className}`}>{s.label}</span>;
}

const SOCIAL_NETWORKS: SocialNetwork[] = [
  "instagram", "tiktok", "youtube", "facebook", "x", "linkedin", "email", "phone", "whatsapp",
];
const PLATFORM_NETWORKS: SocialNetwork[] = [
  "spotify", "apple_music", "deezer", "tidal", "amazon_music",
];

function SocialSelect({
  value,
  kind,
  onChange,
}: {
  value: string;
  kind: "social" | "platform";
  onChange: (v: string) => void;
}) {
  const networks = kind === "platform" ? PLATFORM_NETWORKS : SOCIAL_NETWORKS;
  return (
    <select
      className="h-9 rounded-md border bg-background px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {networks.map((k) => (
        <option key={k} value={k}>
          {SOCIAL_LABEL[k]}
        </option>
      ))}
    </select>
  );
}
