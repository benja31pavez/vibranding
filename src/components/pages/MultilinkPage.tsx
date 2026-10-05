import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Link2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, ListSkeleton } from "@/components/app";
import { uniqueSlug, slugify } from "@/lib/slug";
import { EventsPanel } from "@/components/landing/EventsPanel";
import { MultilinkAnalytics } from "@/components/multilink/MultilinkAnalytics";
import { QrCodeCard } from "@/components/multilink/QrCodeCard";
import { PublicMultilinkView } from "@/components/multilink/PublicMultilinkView";
import { LinkListEditor } from "@/components/multilink/editor/LinkListEditor";
import { ProfileEditor, ThemeEditor } from "@/components/multilink/editor/MultilinkDesign";
import { DevicePreview, type PreviewMode } from "@/components/site/DevicePreview";
import { PublishBar } from "@/components/site/PublishBar";
import { SaveStatus, useSaveShortcut } from "@/components/site/SaveStatus";
import { SectionCard } from "@/components/site/SortableSections";
import { useSaveState } from "@/components/site/useSaveState";
import { multilinkPath, type Multilink, type MultilinkItem as Item } from "@/lib/multilink";
import { diffItems, validateItems, validateProfile } from "@/lib/site/multilinkDraft";
import type { IGProfile } from "@/components/InstagramEditor";
import type { Json } from "@/integrations/supabase/types";

type TabKey = "editar" | "compartir" | "metricas";

type Snapshot = { ml: Multilink; items: Item[] };

export function MultilinkPage({
  clientId,
  onDirtyChange,
}: {
  clientId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { client } = useActiveClient();
  const [draft, setDraft] = useState<Snapshot | null>(null);
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [igProfile, setIgProfile] = useState<IGProfile | null>(null);
  const [landingSlug, setLandingSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [tab, setTab] = useState<TabKey>("editar");
  const [open, setOpen] = useState<string | null>("enlaces");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const save = useSaveState(dirty);
  const errors = useMemo(
    () => (draft ? { ...validateProfile(draft.ml), ...validateItems(draft.items) } : {}),
    [draft],
  );
  const errorCount = Object.keys(errors).length;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [mRes, igRes, lpRes] = await Promise.all([
      supabase.from("multilinks").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("instagram_profiles").select("*").eq("client_id", clientId).maybeSingle(),
      supabase
        .from("landing_pages")
        .select("slug,published")
        .eq("client_id", clientId)
        .maybeSingle(),
    ]);
    const firstError = mRes.error ?? igRes.error;
    if (firstError) {
      setLoadError(firstError.message);
      setLoading(false);
      return;
    }
    setIgProfile((igRes.data ?? null) as IGProfile | null);
    setLandingSlug(lpRes.data?.published ? lpRes.data.slug : null);
    const ml = mRes.data as Multilink | null;
    if (!ml) {
      setDraft(null);
      setSaved(null);
      setLoading(false);
      return;
    }
    const { data: it, error: itemsError } = await supabase
      .from("multilink_items")
      .select("*")
      .eq("multilink_id", ml.id)
      .order("sort_order");
    setLoading(false);
    if (itemsError) {
      setLoadError(itemsError.message);
      return;
    }
    const snap = { ml, items: (it ?? []) as Item[] };
    setDraft(snap);
    setSaved(snap);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const avatarFallback = igProfile?.proposed_avatar_url ?? igProfile?.current_avatar_url ?? null;

  const create = async () => {
    if (!client) return;
    setCreating(true);
    const slug = await uniqueSlug("multilinks", client.instagram_handle || slugify(client.name));
    const { data, error } = await supabase
      .from("multilinks")
      .insert({
        client_id: clientId,
        slug,
        title: client.name,
        avatar_url: avatarFallback,
        theme_color: "#111827",
      })
      .select("*")
      .single();
    setCreating(false);
    if (error) return toast.error(`No se pudo crear el multienlace: ${error.message}`);
    const snap = { ml: data as Multilink, items: [] };
    setDraft(snap);
    setSaved(snap);
    toast.success("Multienlace creado. Agrega WhatsApp e Instagram para partir.");
  };

  const persist = useCallback(async (): Promise<boolean> => {
    if (!draft || !saved) return false;
    if (errorCount > 0) {
      save.fail(`Revisa ${errorCount} campo${errorCount === 1 ? "" : "s"}`);
      toast.error("Hay enlaces con datos incompletos o inválidos (marcados en rojo).");
      return false;
    }
    save.start();
    const { ml, items } = draft;
    const slug = slugify(ml.slug);
    const taken = await supabase
      .from("multilinks")
      .select("id")
      .eq("slug", slug)
      .neq("id", ml.id)
      .maybeSingle();
    if (taken.data) {
      save.fail("Esa dirección ya está en uso");
      toast.error(`La dirección /l/${slug} ya la usa otro multienlace.`);
      return false;
    }
    const mlRow = {
      title: ml.title.trim(),
      bio: ml.bio?.trim() || null,
      avatar_url: ml.avatar_url ?? avatarFallback,
      theme_color: ml.theme_color,
      theme_mode: ml.theme_mode,
      button_style: ml.button_style,
      button_shape: ml.button_shape,
      font_family: ml.font_family,
      background: ml.background as Json,
      slug,
    };
    const plan = diffItems(saved.items, items);
    const fail = (msg: string) => {
      save.fail(msg);
      toast.error(`No se pudo guardar: ${msg}`);
      return false;
    };

    const mlRes = await supabase.from("multilinks").update(mlRow).eq("id", ml.id);
    if (mlRes.error) return fail(mlRes.error.message);

    if (plan.deletes.length) {
      const del = await supabase.from("multilink_items").delete().in("id", plan.deletes);
      if (del.error) return fail(del.error.message);
    }
    const idMap = new Map<string, Item>();
    if (plan.inserts.length) {
      const ins = await supabase
        .from("multilink_items")
        .insert(
          plan.inserts.map((x) => ({ ...x.row, multilink_id: ml.id, client_id: ml.client_id })),
        )
        .select("*");
      if (ins.error) return fail(ins.error.message);
      // insert().select() devuelve las filas en el mismo orden enviado.
      (ins.data ?? []).forEach((row, k) => idMap.set(plan.inserts[k].tempId, row as Item));
    }
    const upd = await Promise.all(
      plan.updates.map((u) => supabase.from("multilink_items").update(u.row).eq("id", u.id)),
    );
    const updError = upd.find((r) => r.error)?.error;
    if (updError) return fail(updError.message);

    const nextItems = items.map((i, idx) => idMap.get(i.id) ?? { ...i, sort_order: idx });
    const next: Snapshot = { ml: { ...ml, ...mlRow }, items: nextItems };
    setDraft(next);
    setSaved(next);
    save.succeed();
    return true;
  }, [draft, saved, errorCount, save, avatarFallback]);

  useSaveShortcut(() => void persist(), dirty, rootRef);

  const onTogglePublished = async () => {
    if (!draft) return;
    const published = !draft.ml.published;
    if (published && dirty && !(await persist())) return;
    if (published && draft.items.filter((i) => i.is_active).length === 0) {
      toast.error("Agrega al menos un enlace visible antes de publicar.");
      return;
    }
    setToggling(true);
    const { error } = await supabase.from("multilinks").update({ published }).eq("id", draft.ml.id);
    setToggling(false);
    if (error) return toast.error(error.message);
    setDraft((d) => (d ? { ...d, ml: { ...d.ml, published } } : d));
    setSaved((s) => (s ? { ...s, ml: { ...s.ml, published } } : s));
    toast.success(published ? "Multienlace publicado" : "El multienlace quedó como borrador");
  };

  if (loadError) {
    return (
      <ErrorState
        title="No pudimos cargar el multienlace"
        message={loadError}
        onRetry={() => void load()}
        retrying={loading}
      />
    );
  }
  if (loading) return <ListSkeleton rows={4} label="Cargando multienlace" />;

  if (!draft || !saved) {
    return (
      <section className="space-y-4 rounded-3xl border bg-surface p-8 text-center">
        <Link2 className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Multienlace de {client?.name}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          La página de enlaces para la bio de Instagram y TikTok: WhatsApp, redes, ubicación,
          reseñas y la landing, con QR para imprimir.
        </p>
        <Button onClick={() => void create()} disabled={creating}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />{" "}
          {creating ? "Creando…" : "Crear multienlace"}
        </Button>
      </section>
    );
  }

  const { ml, items } = draft;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}${multilinkPath(saved.ml.slug)}`;
  const landingUrl = landingSlug ? `${origin}/@${landingSlug}` : null;
  const setMl = (next: Multilink) => setDraft({ ...draft, ml: next });
  const setItems = (next: Item[]) => setDraft({ ...draft, items: next });
  const profileHasError = !!(errors.title || errors.slug);
  const linksHaveError = errorCount - (errors.title ? 1 : 0) - (errors.slug ? 1 : 0) > 0;

  return (
    <div ref={rootRef} className="space-y-6">
      <PublishBar
        title="Multienlace"
        subtitle="Todos los enlaces del cliente en una página para la bio de Instagram y TikTok."
        published={ml.published}
        publicUrl={publicUrl}
        onTogglePublished={() => void onTogglePublished()}
        toggling={toggling || save.saving}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-5">
        <TabsList>
          <TabsTrigger value="editar">Editar</TabsTrigger>
          <TabsTrigger value="compartir">Compartir y QR</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="editar">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,480px)]">
            <div className="min-w-0 space-y-3">
              <SectionCard
                row={{
                  id: "enlaces",
                  title: "Enlaces",
                  summary: `${items.filter((i) => i.is_active).length} visibles de ${items.length}`,
                  enabled: true,
                  toggleable: false,
                  hasError: linksHaveError,
                  content: (
                    <LinkListEditor
                      ml={ml}
                      items={items}
                      onChange={setItems}
                      errors={errors}
                      clientId={clientId}
                      landingUrl={landingUrl}
                    />
                  ),
                }}
                open={open === "enlaces"}
                onToggleOpen={() => setOpen(open === "enlaces" ? null : "enlaces")}
              />
              <SectionCard
                row={{
                  id: "perfil",
                  title: "Perfil",
                  summary: ml.title,
                  enabled: true,
                  toggleable: false,
                  hasError: profileHasError,
                  content: (
                    <ProfileEditor
                      ml={ml}
                      onChange={setMl}
                      errors={errors}
                      clientId={clientId}
                      avatarFallback={avatarFallback}
                    />
                  ),
                }}
                open={open === "perfil"}
                onToggleOpen={() => setOpen(open === "perfil" ? null : "perfil")}
              />
              <SectionCard
                row={{
                  id: "tema",
                  title: "Tema y colores",
                  summary: ml.theme_mode === "dark" ? "Oscuro" : "Claro",
                  enabled: true,
                  toggleable: false,
                  content: <ThemeEditor ml={ml} onChange={setMl} />,
                }}
                open={open === "tema"}
                onToggleOpen={() => setOpen(open === "tema" ? null : "tema")}
              />

              <div className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-surface/95 px-4 py-3 shadow-sm backdrop-blur">
                <SaveStatus state={save.state} detail={save.detail} />
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft(saved)}
                    disabled={!dirty || save.saving}
                  >
                    Descartar
                  </Button>
                  <Button size="sm" onClick={() => void persist()} disabled={!dirty || save.saving}>
                    <Save className="mr-1 h-4 w-4" aria-hidden="true" /> Guardar
                  </Button>
                </div>
              </div>
            </div>

            <div className="xl:sticky xl:top-20">
              <DevicePreview
                mode={previewMode}
                onModeChange={setPreviewMode}
                label="Vista previa del multienlace"
              >
                <PublicMultilinkView
                  ml={{ ...ml, avatar_url: ml.avatar_url ?? avatarFallback }}
                  items={items}
                  preview
                />
              </DevicePreview>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compartir" className="space-y-6">
          <section className="space-y-2 rounded-2xl border bg-surface p-5 text-sm">
            <h2 className="font-medium">Dónde usarlo</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>En la bio de Instagram y TikTok (Editar perfil → Enlaces).</li>
              <li>En el estado y el perfil de empresa de WhatsApp Business.</li>
              <li>El QR va en tarjetas, vitrina, packaging y vehículos.</li>
            </ul>
            {!ml.published && (
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Aún es borrador: publícalo para que el link y el QR funcionen.
              </p>
            )}
          </section>
          <QrCodeCard url={publicUrl} fileBase={`${saved.ml.slug}-multienlace`} />
        </TabsContent>

        <TabsContent value="metricas" className="space-y-6">
          {!ml.published ? (
            <div className="space-y-2 rounded-2xl border border-dashed bg-surface p-8 text-center">
              <Activity className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">Este multienlace aún es borrador</p>
              <p className="text-sm text-muted-foreground">
                Las visitas y clics se miden desde que lo publicas.
              </p>
            </div>
          ) : (
            <>
              <MultilinkAnalytics clientId={clientId} multilinkId={ml.id} items={saved.items} />
              <EventsPanel
                clientId={clientId}
                sourceType="multilink"
                sourceId={ml.id}
                itemLabels={Object.fromEntries(saved.items.map((i) => [i.id, i.title]))}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
