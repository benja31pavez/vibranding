import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app";
import { uniqueSlug } from "@/lib/slug";
import { EventsPanel } from "@/components/landing/EventsPanel";
import { MultilinkAnalytics } from "@/components/multilink/MultilinkAnalytics";
import { QrCodeCard } from "@/components/multilink/QrCodeCard";
import { PublicMultilinkView } from "@/components/multilink/PublicMultilinkView";
import { LinkListEditor } from "@/components/multilink/editor/LinkListEditor";
import { ProfileEditor, ThemeEditor } from "@/components/multilink/editor/MultilinkDesign";
import { DevicePreview, type PreviewMode } from "@/components/site/DevicePreview";
import { PublishBar } from "@/components/site/PublishBar";
import { useSaveShortcut } from "@/components/site/SaveStatus";
import {
  EditorSplit,
  ReadOnlyPreview,
  SaveBar,
  ScrollColumn,
  SiteNav,
  SitePane,
  SiteViewTab,
} from "@/components/site/SiteEditorLayout";
import { SectionCard } from "@/components/site/SortableSections";
import { useSaveState } from "@/components/site/useSaveState";
import { copyPublicLink } from "@/components/site/copyLink";
import {
  MULTILINK_VIEW_OF_SECTION,
  type MultilinkViewTab,
  type SiteSection,
} from "@/components/site/siteSections";
import { meaningfulBio } from "@/components/multilink/bio";
import { slugSeed, useClientSiteData } from "@/components/site/useClientSiteData";
import { type Multilink, type MultilinkItem as Item } from "@/lib/multilink";
import {
  displayUrl,
  landingPublicUrl,
  multilinkLinksStatus,
  multilinkPublicUrlFor,
} from "@/lib/site/siteStatus";
import { validateItems, validateProfile } from "@/lib/site/multilinkDraft";
import { fetchMultilinkSnapshot, saveMultilink } from "@/lib/site/multilinkSave";
import { writeFailed } from "@/lib/writeCheck";
import type { IGProfile } from "@/components/InstagramEditor";

type TabKey = MultilinkViewTab;

type Snapshot = { ml: Multilink; items: Item[] };

export function MultilinkPage({
  clientId,
  onDirtyChange,
  pageSwitcher,
  readOnly = false,
  section,
}: {
  clientId: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** Selector Multienlace / Landing page que va en la misma barra de pestañas. */
  pageSwitcher?: React.ReactNode;
  /** Solo lectura (futuro panel del cliente): vista previa grande + link, sin edición. */
  readOnly?: boolean;
  /**
   * Controlado desde la pantalla "Sitio": la subsección activa fija la vista interna
   * (Secciones = editar, Dominio y conexiones = compartir y QR, Analítica = métricas) y
   * la barra interna de vistas no se dibuja.
   */
  section?: SiteSection;
}) {
  const { client } = useActiveClient();
  const clientData = useClientSiteData(clientId);
  const [draft, setDraft] = useState<Snapshot | null>(null);
  const [saved, setSaved] = useState<Snapshot | null>(null);
  const [igProfile, setIgProfile] = useState<IGProfile | null>(null);
  const [landingSlug, setLandingSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [localTab, setLocalTab] = useState<TabKey>("editar");
  const controlled = section !== undefined;
  const tab: TabKey = controlled ? MULTILINK_VIEW_OF_SECTION[section] : localTab;
  /** Secciones abiertas (varias a la vez); null = automático según lo que falte. */
  const [openSet, setOpenSet] = useState<ReadonlySet<string> | null>(null);
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

  // Foto por defecto: el logo del cliente; si no hay, la de Instagram.
  const igAvatar = igProfile?.proposed_avatar_url ?? igProfile?.current_avatar_url ?? null;
  const avatarFallback = clientData.logoUrl ?? igAvatar;
  const avatarSource = clientData.logoUrl ? "logo" : igAvatar ? "instagram" : null;

  const create = async () => {
    if (!client) return;
    setCreating(true);
    const slug = await uniqueSlug("multilinks", slugSeed(client.instagram_handle, client.name));
    const { data, error } = await supabase
      .from("multilinks")
      .insert({
        client_id: clientId,
        slug,
        title: client.name,
        bio: clientData.description?.slice(0, 200) ?? null,
        avatar_url: avatarFallback,
        theme_color: clientData.brandColors[0] ?? "#111827",
      })
      .select("*")
      .single();
    setCreating(false);
    if (error) return toast.error(`No se pudo crear el multienlace: ${error.message}`);
    const snap = { ml: data as Multilink, items: [] };
    setDraft(snap);
    setSaved(snap);
    toast.success("Multienlace creado");
  };

  const persist = useCallback(async (): Promise<boolean> => {
    if (!draft || !saved) return false;
    if (errorCount > 0) {
      save.fail(`Revisa ${errorCount} campo${errorCount === 1 ? "" : "s"}`);
      toast.error("Hay enlaces con datos incompletos o inválidos (marcados en rojo).");
      return false;
    }
    save.start();
    const result = await saveMultilink(saved, draft, avatarFallback);
    if (result.ok) {
      setDraft(result.snapshot);
      setSaved(result.snapshot);
      save.succeed();
      return true;
    }
    save.fail(result.message);
    toast.error(`No se pudo guardar: ${result.message}`);
    // Lo que alcanzó a guardarse pasa a ser la base; los enlaces ya insertados conservan su id real.
    const fresh = await fetchMultilinkSnapshot(draft.ml.id);
    if (fresh) {
      setSaved(fresh);
      setDraft((d) =>
        d
          ? {
              ...d,
              items: d.items.map((i) =>
                result.idMap.has(i.id)
                  ? { ...result.idMap.get(i.id)!, ...i, id: result.idMap.get(i.id)!.id }
                  : i,
              ),
            }
          : d,
      );
    }
    return false;
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
    const res = await supabase
      .from("multilinks")
      .update({ published })
      .eq("id", draft.ml.id)
      .select("id");
    setToggling(false);
    if (writeFailed(res, published ? "No se pudo publicar" : "No se pudo pasar a borrador")) return;
    setDraft((d) => (d ? { ...d, ml: { ...d.ml, published } } : d));
    setSaved((s) => (s ? { ...s, ml: { ...s.ml, published } } : s));
    if (!published) return void toast.success("El multienlace quedó como borrador");
    const url = multilinkPublicUrlFor(draft.ml);
    toast.success("Multienlace publicado", {
      description: displayUrl(url),
      action: { label: "Copiar link", onClick: () => void copyPublicLink(url) },
    });
  };

  const shell = (content: React.ReactNode) => (
    <div ref={rootRef} className="flex flex-col gap-4 md:h-full md:min-h-0">
      <SiteNav pageSwitcher={pageSwitcher} />
      <ScrollColumn className="md:flex-1">{content}</ScrollColumn>
    </div>
  );

  if (loadError) {
    return shell(
      <ErrorState
        title="No pudimos cargar el multienlace"
        message={loadError}
        onRetry={() => void load()}
        retrying={loading}
      />,
    );
  }
  if (loading) return shell(<ListSkeleton rows={4} label="Cargando multienlace" />);

  if (!draft || !saved) {
    return shell(
      <EmptyState
        icon={Link2}
        title={
          readOnly
            ? "El multienlace aún no está listo"
            : `Multienlace de ${client?.name ?? "este cliente"}`
        }
        description={readOnly ? undefined : "Los enlaces de la bio de Instagram y TikTok, con QR."}
        action={
          readOnly ? undefined : (
            <Button onClick={() => void create()} disabled={creating}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              {creating ? "Creando…" : "Crear multienlace"}
            </Button>
          )
        }
      />,
    );
  }

  const { ml, items } = draft;
  const publicUrl = multilinkPublicUrlFor(saved.ml);
  const landingUrl = landingSlug ? landingPublicUrl(landingSlug) : null;
  const setMl = (next: Multilink) => setDraft({ ...draft, ml: next });
  const setItems = (next: Item[]) => setDraft({ ...draft, items: next });
  const profileHasError = !!(errors.title || errors.slug);
  const linksHaveError = errorCount - (errors.title ? 1 : 0) - (errors.slug ? 1 : 0) > 0;
  const profileNeedsWork =
    profileHasError || !meaningfulBio(ml.bio) || (!saved.ml.published && ml.slug.includes("."));
  const open = openSet ?? new Set(["enlaces", ...(profileNeedsWork ? ["perfil"] : [])]);
  const toggle = (key: string) => {
    const next = new Set(open);
    if (!next.delete(key)) next.add(key);
    setOpenSet(next);
  };

  const preview = (snap: Snapshot) => (
    <DevicePreview
      mode={previewMode}
      onModeChange={setPreviewMode}
      label="Vista previa del multienlace"
    >
      <PublicMultilinkView
        ml={{ ...snap.ml, avatar_url: snap.ml.avatar_url ?? avatarFallback }}
        items={snap.items}
        preview
      />
    </DevicePreview>
  );

  if (readOnly) {
    return (
      <div ref={rootRef} className="flex flex-col gap-4 md:h-full md:min-h-0">
        <PublishBar
          nav={<SiteNav pageSwitcher={pageSwitcher} />}
          published={saved.ml.published}
          publicUrl={publicUrl}
          pageLabel="el multienlace"
          qrFileBase={`${saved.ml.slug}-multienlace`}
          readOnly
        />
        <ReadOnlyPreview>{preview(saved)}</ReadOnlyPreview>
      </div>
    );
  }

  const editor = (
    <div className="space-y-3">
      <SectionCard
        row={{
          id: "enlaces",
          title: "Enlaces",
          summary: `${items.filter((i) => i.is_active).length} visibles de ${items.length}`,
          enabled: true,
          toggleable: false,
          hasError: linksHaveError,
          status: multilinkLinksStatus(items, linksHaveError),
          content: (
            <LinkListEditor
              ml={ml}
              items={items}
              onChange={setItems}
              errors={errors}
              clientId={clientId}
              landingUrl={landingUrl}
              clientData={clientData}
            />
          ),
        }}
        open={open.has("enlaces")}
        onToggleOpen={() => toggle("enlaces")}
      />
      <SectionCard
        row={{
          id: "perfil",
          title: "Perfil",
          summary: ml.title,
          enabled: true,
          toggleable: false,
          hasError: profileHasError,
          status: profileHasError
            ? "error"
            : !ml.title.trim()
              ? "missing"
              : (ml.bio ?? "").trim() && !meaningfulBio(ml.bio)
                ? "error"
                : "complete",
          content: (
            <ProfileEditor
              ml={ml}
              onChange={setMl}
              errors={errors}
              clientId={clientId}
              avatarFallback={avatarFallback}
              avatarSource={avatarSource}
              clientDescription={clientData.description}
              published={saved.ml.published}
            />
          ),
        }}
        open={open.has("perfil")}
        onToggleOpen={() => toggle("perfil")}
      />
      <SectionCard
        row={{
          id: "tema",
          title: "Tema y colores",
          summary: ml.theme_mode === "dark" ? "Oscuro" : "Claro",
          enabled: true,
          toggleable: false,
          content: <ThemeEditor ml={ml} onChange={setMl} brandColors={clientData.brandColors} />,
        }}
        open={open.has("tema")}
        onToggleOpen={() => toggle("tema")}
      />
    </div>
  );

  return (
    <div ref={rootRef} className="md:h-full md:min-h-0">
      <Tabs
        value={tab}
        onValueChange={(v) => !controlled && setLocalTab(v as TabKey)}
        className="flex flex-col gap-4 md:h-full md:min-h-0"
      >
        <PublishBar
          nav={
            <SiteNav pageSwitcher={pageSwitcher}>
              {!controlled && (
                <>
                  <SiteViewTab value="editar">Editar</SiteViewTab>
                  <SiteViewTab value="compartir">Compartir y QR</SiteViewTab>
                  <SiteViewTab value="metricas">Métricas</SiteViewTab>
                </>
              )}
            </SiteNav>
          }
          published={ml.published}
          publicUrl={publicUrl}
          pageLabel="el multienlace"
          qrFileBase={`${saved.ml.slug}-multienlace`}
          onTogglePublished={() => void onTogglePublished()}
          toggling={toggling || save.saving}
        />

        <SitePane value="editar">
          <EditorSplit
            editor={editor}
            footer={
              <SaveBar
                state={save.state}
                detail={save.detail}
                dirty={dirty}
                saving={save.saving}
                onDiscard={() => setDraft(saved)}
                onSave={() => void persist()}
              />
            }
            preview={preview(draft)}
            widePreview={previewMode === "desktop"}
          />
        </SitePane>

        <SitePane value="compartir">
          <ScrollColumn className="max-w-4xl">
            <section className="space-y-2 rounded-app-lg border border-border-subtle bg-surface p-5 text-sm shadow-app-xs">
              <h2 className="font-medium">Dónde usarlo</h2>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>En la bio de Instagram y TikTok (Editar perfil → Enlaces).</li>
                <li>En el estado y el perfil de empresa de WhatsApp Business.</li>
                <li>El QR va en tarjetas, vitrina, packaging y vehículos.</li>
              </ul>
              {!ml.published && (
                <p className="font-medium text-warning-strong">
                  Aún es borrador: publícalo para que el link y el QR funcionen.
                </p>
              )}
            </section>
            <QrCodeCard url={publicUrl} fileBase={`${saved.ml.slug}-multienlace`} />
          </ScrollColumn>
        </SitePane>

        <SitePane value="metricas">
          <ScrollColumn>
            {!ml.published ? (
              <EmptyState
                icon={Activity}
                title="Las visitas y clics se miden desde que publicas el multienlace."
              />
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
          </ScrollColumn>
        </SitePane>
      </Tabs>
    </div>
  );
}
