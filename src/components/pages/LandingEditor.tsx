import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Globe, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog, EmptyState, ErrorState, InfoHint, ListSkeleton } from "@/components/app";
import { uniqueSlug, slugify } from "@/lib/slug";
import { formatChileMobile } from "@/lib/site/validation";
import { writeError, writeFailed } from "@/lib/writeCheck";
import { EventsPanel } from "@/components/landing/EventsPanel";
import { LandingAnalytics } from "@/components/landing/LandingAnalytics";
import { PublicLandingView } from "@/components/landing/PublicLandingView";
import { DevicePreview, type PreviewMode } from "@/components/site/DevicePreview";
import { revealPreviewSection } from "@/lib/site/previewReveal";
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
import { useSaveState } from "@/components/site/useSaveState";
import { copyPublicLink } from "@/components/site/copyLink";
import { slugSeed, useClientSiteData } from "@/components/site/useClientSiteData";
import {
  moveBy,
  SectionCard,
  SortableList,
  SortableSectionCard,
  type SectionRow,
} from "@/components/site/SortableSections";
import { TemplatePicker } from "@/components/landing/editor/TemplatePicker";
import { HeroEditor, StyleEditor } from "@/components/landing/editor/HeroStyleEditor";
import {
  FaqEditor,
  GalleryEditor,
  ServicesEditor,
  TestimonialsEditor,
} from "@/components/landing/editor/ContentEditors";
import {
  ContactFormEditor,
  LocationEditor,
  WhatsappEditor,
} from "@/components/landing/editor/ContactEditors";
import { LandingSettings } from "@/components/landing/editor/LandingSettings";
import { ContactInbox } from "@/components/landing/editor/ContactInbox";
import { LANDING_SECTION_LABEL, TEMPLATE_LABEL, type LandingSectionKey } from "@/lib/landingTheme";
import { rubroTemplate, type RubroKey } from "@/lib/site/landingTemplates";
import {
  applyRubroTemplate,
  countExampleTexts,
  FIELD_LABEL,
  isSectionEnabled,
  landingForView,
  landingUpdatePayload,
  normalizeLanding,
  setSectionEnabled,
  validateLanding,
  type LandingDraft,
  type LandingErrors,
} from "@/lib/site/landingDraft";
import {
  displayUrl,
  heroStatus,
  landingPublicUrl,
  landingSectionStatus,
} from "@/lib/site/siteStatus";

type TabKey = "editar" | "ajustes" | "mensajes" | "metricas";

/** Campos con error que pertenecen a cada sección (para abrirla y marcarla). */
const SECTION_ERROR_KEYS: Partial<Record<LandingSectionKey | "hero", string[]>> = {
  hero: ["hero_title", "cta_url"],
  whatsapp: ["whatsapp_number"],
  ubicacion: ["location.map_embed_url"],
};

export function LandingEditor({
  clientId,
  onDirtyChange,
  pageSwitcher,
  readOnly = false,
}: {
  clientId: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** Selector Multienlace / Landing page que va en la misma barra de pestañas. */
  pageSwitcher?: React.ReactNode;
  /** Solo lectura (futuro panel del cliente): vista previa grande + link, sin edición. */
  readOnly?: boolean;
}) {
  const { client } = useActiveClient();
  const clientData = useClientSiteData(clientId);
  const [lp, setLp] = useState<LandingDraft | null>(null);
  const [saved, setSaved] = useState<LandingDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState<RubroKey | "blank" | null>(null);
  const [tab, setTab] = useState<TabKey>("editar");
  const [openSection, setOpenSection] = useState<string | null>("hero");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [toggling, setToggling] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<RubroKey | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewDoc = useRef<Document | null>(null);

  const dirty = !!lp && !!saved && JSON.stringify(lp) !== JSON.stringify(saved);
  const save = useSaveState(dirty);
  const errors: LandingErrors = useMemo(() => (lp ? validateLanding(lp) : {}), [lp]);
  const errorCount = Object.keys(errors).length;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    setLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    const draft = data ? normalizeLanding(data) : null;
    setLp(draft);
    setSaved(draft);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (rubro: RubroKey | null) => {
    if (!client) return;
    setCreating(rubro ?? "blank");
    try {
      const slug = await uniqueSlug(
        "landing_pages",
        slugSeed(client.instagram_handle, client.name),
      );
      const blank = normalizeLanding({
        id: "",
        client_id: clientId,
        slug,
        published: false,
        hero_title: client.name,
        cta_text: "Contáctanos",
        footer: client.instagram_handle
          ? { instagram: `https://instagram.com/${client.instagram_handle.replace(/^@/, "")}` }
          : {},
      });
      const templated = rubro
        ? applyRubroTemplate(blank, rubroTemplate(rubro), client.name)
        : blank;
      // Datos que el cliente ya entregó: su color y su WhatsApp, en vez de los de la plantilla.
      const brand = clientData.brandColors[0];
      const draft: LandingDraft = {
        ...templated,
        ...(brand ? { theme_color: brand } : {}),
        ...(clientData.whatsapp
          ? { whatsapp_number: formatChileMobile(clientData.whatsapp), whatsapp_enabled: true }
          : {}),
      };
      const { data, error } = await supabase
        .from("landing_pages")
        .insert({ client_id: clientId, ...landingUpdatePayload(draft, slug) })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const created = normalizeLanding(data);
      setLp(created);
      setSaved(created);
      toast.success(
        rubro
          ? "Landing creada con la plantilla. Reemplaza los textos marcados."
          : "Landing creada",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la landing");
    } finally {
      setCreating(null);
    }
  };

  const persist = useCallback(async (): Promise<boolean> => {
    if (!lp) return false;
    if (errorCount > 0) {
      const first = Object.keys(errors)[0];
      save.fail(`Revisa ${errorCount} campo${errorCount === 1 ? "" : "s"}`);
      toast.error(
        `Corrige antes de guardar: ${FIELD_LABEL[first.replace(/\.\d+$/, "")] ?? "Enlaces legales"}`,
      );
      return false;
    }
    const slug = slugify(lp.slug);
    save.start();
    const taken = await supabase
      .from("landing_pages")
      .select("id")
      .eq("slug", slug)
      .neq("id", lp.id)
      .maybeSingle();
    if (taken.data) {
      save.fail("Esa dirección ya está en uso");
      toast.error(`La dirección /@${slug} ya la usa otra landing. Elige otra en Ajustes.`);
      return false;
    }
    const payload = landingUpdatePayload(lp, slug);
    const err = writeError(
      await supabase.from("landing_pages").update(payload).eq("id", lp.id).select("id"),
    );
    if (err) {
      save.fail(err);
      toast.error(`No se pudo guardar: ${err}`);
      return false;
    }
    const next = normalizeLanding({ ...lp, ...payload });
    setLp(next);
    setSaved(next);
    save.succeed();
    return true;
  }, [lp, errors, errorCount, save]);

  useSaveShortcut(() => void persist(), dirty, rootRef);

  const setPublished = async (published: boolean) => {
    if (!lp || !saved) return;
    setToggling(true);
    const res = await supabase
      .from("landing_pages")
      .update({ published })
      .eq("id", lp.id)
      .select("id");
    setToggling(false);
    if (writeFailed(res, published ? "No se pudo publicar" : "No se pudo pasar a borrador")) return;
    setLp((cur) => (cur ? { ...cur, published } : cur));
    setSaved((cur) => (cur ? { ...cur, published } : cur));
    if (!published) return void toast.success("La landing quedó como borrador");
    const url = landingPublicUrl(saved.slug);
    toast.success("Landing publicada", {
      description: displayUrl(url),
      action: {
        label: "Copiar link",
        onClick: () => void copyPublicLink(url),
      },
    });
  };

  const onTogglePublished = async () => {
    if (!lp) return;
    if (lp.published) return setPublished(false);
    if (dirty && !(await persist())) return;
    const pending: string[] = [];
    const examples = countExampleTexts(lp);
    if (examples > 0)
      pending.push(`${examples} texto${examples === 1 ? "" : "s"} de ejemplo sin reemplazar`);
    if (!lp.whatsapp_enabled && !lp.contact_enabled)
      pending.push("no hay WhatsApp ni formulario de contacto");
    if (!lp.hero_image_url) pending.push("falta la foto principal");
    if (pending.length > 0) return setConfirmPublish(pending.join(" · "));
    return setPublished(true);
  };

  const scrollPreviewTo = (key: string) => revealPreviewSection(previewDoc.current, key);

  const toggleOpen = (key: string) => {
    setOpenSection((prev) => (prev === key ? null : key));
    if (openSection === key) return;
    requestAnimationFrame(() => {
      scrollPreviewTo(key);
      // La sección abierta queda a la vista dentro de la columna del editor.
      document
        .getElementById(`section-panel-${key}`)
        ?.closest("section")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const applyTemplate = (key: RubroKey) => {
    if (!lp || !client) return;
    setLp(applyRubroTemplate(lp, rubroTemplate(key), client.name));
    setPendingTemplate(null);
    setTemplateOpen(false);
    toast.success("Plantilla aplicada. Revisa la vista previa y guarda.");
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
        title="No pudimos cargar la landing"
        message={loadError}
        onRetry={() => void load()}
        retrying={loading}
      />,
    );
  }
  if (loading) return shell(<ListSkeleton rows={4} label="Cargando landing" />);

  if (!lp || !saved) {
    if (readOnly) return shell(<EmptyState icon={Globe} title="La landing aún no está lista" />);
    // Lo que se trae del cliente al crearla (sin inventar nada).
    const prefill = [
      clientData.whatsapp && `su WhatsApp ${formatChileMobile(clientData.whatsapp)}`,
      clientData.brandColors.length > 0 && "sus colores de marca",
    ].filter((x): x is string => !!x);
    return shell(
      <section className="space-y-5 rounded-app-lg border border-border-subtle bg-surface p-6 shadow-app-xs md:p-8">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Crear la landing de {client?.name}</h2>
          <InfoHint label="Sobre las plantillas">
            Cada plantilla trae secciones, servicios y preguntas frecuentes listos para adaptar. Los
            textos de ejemplo quedan marcados para reemplazarlos.
          </InfoHint>
        </div>
        {prefill.length > 0 && (
          <p className="text-sm text-muted-foreground">Parte con {prefill.join(" y ")}.</p>
        )}
        <TemplatePicker onPick={(k) => void create(k)} busy={creating} />
      </section>,
    );
  }

  const publicUrl = landingPublicUrl(saved.slug);

  const preview = (draft: LandingDraft) => (
    <DevicePreview
      mode={previewMode}
      onModeChange={setPreviewMode}
      label="Vista previa de la landing"
      onDocument={(d) => {
        previewDoc.current = d;
      }}
    >
      <PublicLandingView lp={landingForView(draft)} preview />
    </DevicePreview>
  );

  if (readOnly) {
    return (
      <div ref={rootRef} className="flex flex-col gap-4 md:h-full md:min-h-0">
        <PublishBar
          nav={<SiteNav pageSwitcher={pageSwitcher} />}
          published={saved.published}
          publicUrl={publicUrl}
          pageLabel="la landing"
          qrFileBase={`${saved.slug}-landing`}
          readOnly
        />
        <ReadOnlyPreview>{preview(saved)}</ReadOnlyPreview>
      </div>
    );
  }

  const sectionHasError = (key: string) =>
    (SECTION_ERROR_KEYS[key as LandingSectionKey] ?? []).some((k) => errors[k]);
  const update = (next: LandingDraft) => setLp(next);
  const props = { lp, onChange: update, errors, clientId };
  const settingsHaveError = ["slug", "footer."].some((p) =>
    Object.keys(errors).some((k) => k.startsWith(p)),
  );

  const sectionRows: Record<LandingSectionKey, SectionRow> = {
    servicios: row(
      "servicios",
      plural(lp.services.length, "servicio", "servicios"),
      <ServicesEditor {...props} />,
    ),
    galeria: row(
      "galeria",
      plural(lp.gallery.length, "foto", "fotos"),
      <GalleryEditor {...props} />,
    ),
    whatsapp: row("whatsapp", lp.whatsapp_number ?? "", <WhatsappEditor {...props} />),
    testimonios: row(
      "testimonios",
      plural(lp.testimonials.filter((t) => t.quote.trim()).length, "testimonio", "testimonios"),
      <TestimonialsEditor {...props} />,
    ),
    ubicacion: row(
      "ubicacion",
      [lp.location.comuna, plural((lp.location.comunas ?? []).length, "comuna", "comunas")]
        .filter(Boolean)
        .join(" · "),
      <LocationEditor {...props} />,
    ),
    faq: row("faq", plural(lp.faq.length, "pregunta", "preguntas"), <FaqEditor {...props} />),
    contacto: row(
      "contacto",
      plural(inboxCount, "mensaje", "mensajes"),
      <ContactFormEditor submissions={inboxCount} onOpenInbox={() => setTab("mensajes")} />,
    ),
  };

  function row(key: LandingSectionKey, summary: string, content: React.ReactNode): SectionRow {
    const hasError = sectionHasError(key);
    return {
      id: key,
      title: LANDING_SECTION_LABEL[key],
      summary,
      enabled: isSectionEnabled(lp!, key),
      toggleable: true,
      content,
      hasError,
      status: landingSectionStatus(lp!, key, hasError),
    };
  }

  const saveBar = (
    <SaveBar
      state={save.state}
      detail={save.detail}
      dirty={dirty}
      saving={save.saving}
      onDiscard={() => setLp(saved)}
      onSave={() => void persist()}
    />
  );

  const editor = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium">Diseño {TEMPLATE_LABEL[lp.template]}</h2>
          <InfoHint label="Cómo ordenar las secciones">
            Arrastra las secciones (o usa las flechas) para cambiar el orden; el interruptor las
            muestra u oculta. Al abrir una sección, la vista previa salta a ella.
          </InfoHint>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
          <LayoutTemplate className="mr-1 h-4 w-4" aria-hidden="true" /> Plantillas por rubro
        </Button>
      </div>

      <SectionCard
        row={{
          id: "estilo",
          title: "Colores y estilo",
          summary: lp.dark_mode ? "Modo oscuro" : "Modo claro",
          enabled: true,
          toggleable: false,
          content: <StyleEditor lp={lp} onChange={update} brandColors={clientData.brandColors} />,
        }}
        open={openSection === "estilo"}
        onToggleOpen={() => toggleOpen("estilo")}
      />
      <SectionCard
        row={{
          id: "hero",
          title: "Portada",
          summary: lp.hero_title,
          enabled: true,
          toggleable: false,
          content: <HeroEditor {...props} />,
          hasError: sectionHasError("hero"),
          status: heroStatus(lp, sectionHasError("hero")),
        }}
        open={openSection === "hero"}
        onToggleOpen={() => toggleOpen("hero")}
      />

      <h3 className="pt-2 text-xs uppercase tracking-widest text-muted-foreground">
        Secciones de la página
      </h3>
      <SortableList
        ids={lp.section_order}
        onReorder={(section_order) => update({ ...lp, section_order })}
        getLabel={(k) => LANDING_SECTION_LABEL[k]}
      >
        <div className="space-y-3">
          {lp.section_order.map((key, idx) => (
            <SortableSectionCard
              key={key}
              row={sectionRows[key]}
              open={openSection === key}
              onToggleOpen={() => toggleOpen(key)}
              onMove={(dir) => update({ ...lp, section_order: moveBy(lp.section_order, idx, dir) })}
              canMoveUp={idx > 0}
              canMoveDown={idx < lp.section_order.length - 1}
              onToggleEnabled={(on) => {
                update(setSectionEnabled(lp, key, on));
                if (on) requestAnimationFrame(() => scrollPreviewTo(key));
              }}
            />
          ))}
        </div>
      </SortableList>
    </div>
  );

  return (
    <div ref={rootRef} className="md:h-full md:min-h-0">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="flex flex-col gap-4 md:h-full md:min-h-0"
      >
        <PublishBar
          nav={
            <SiteNav pageSwitcher={pageSwitcher}>
              <SiteViewTab value="editar">Editar</SiteViewTab>
              <SiteViewTab value="ajustes">
                Ajustes y SEO
                {settingsHaveError && (
                  <span className="h-2 w-2 rounded-full bg-destructive" aria-label="con errores" />
                )}
              </SiteViewTab>
              <SiteViewTab value="mensajes">
                Mensajes
                {inboxCount > 0 && <span className="tabular-nums">{inboxCount}</span>}
              </SiteViewTab>
              <SiteViewTab value="metricas">Métricas</SiteViewTab>
            </SiteNav>
          }
          published={lp.published}
          publicUrl={publicUrl}
          pageLabel="la landing"
          qrFileBase={`${saved.slug}-landing`}
          onTogglePublished={() => void onTogglePublished()}
          toggling={toggling || save.saving}
        />

        <SitePane value="editar">
          <EditorSplit
            editor={editor}
            footer={saveBar}
            preview={preview(lp)}
            widePreview={previewMode === "desktop"}
          />
        </SitePane>

        <SitePane value="ajustes">
          <ScrollColumn footer={saveBar} className="max-w-4xl">
            <LandingSettings lp={lp} onChange={update} errors={errors} />
          </ScrollColumn>
        </SitePane>

        <SitePane value="mensajes" forceMount>
          <ScrollColumn className="max-w-4xl">
            <ContactInbox clientId={clientId} onCount={setInboxCount} />
          </ScrollColumn>
        </SitePane>

        <SitePane value="metricas">
          <ScrollColumn>
            {!lp.published ? (
              <EmptyState
                icon={Activity}
                title="Las visitas y clics se miden desde que publicas la landing."
              />
            ) : (
              <>
                <LandingAnalytics clientId={clientId} landingId={lp.id} />
                <EventsPanel clientId={clientId} sourceType="landing" sourceId={lp.id} />
              </>
            )}
          </ScrollColumn>
        </SitePane>
      </Tabs>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Plantillas por rubro</DialogTitle>
            <DialogDescription>
              Reemplaza textos, servicios, preguntas, colores y orden de secciones. Se mantienen el
              nombre, las fotos, el WhatsApp y los datos de contacto. Puedes descartar si no te
              gusta.
            </DialogDescription>
          </DialogHeader>
          <TemplatePicker allowBlank={false} onPick={(k) => k && setPendingTemplate(k)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingTemplate}
        onOpenChange={(o) => !o && setPendingTemplate(null)}
        title={`¿Aplicar la plantilla "${pendingTemplate ? rubroTemplate(pendingTemplate).label : ""}"?`}
        description="Los textos actuales de portada, servicios y preguntas frecuentes se reemplazan por los de la plantilla. No se guarda hasta que presiones Guardar."
        confirmLabel="Aplicar plantilla"
        onConfirm={() => pendingTemplate && applyTemplate(pendingTemplate)}
      />

      <ConfirmDialog
        open={!!confirmPublish}
        onOpenChange={(o) => !o && setConfirmPublish(null)}
        title="¿Publicar de todos modos?"
        description={`Antes de mostrarla al público revisa: ${confirmPublish ?? ""}.`}
        confirmLabel="Publicar igual"
        cancelLabel="Seguir editando"
        onConfirm={() => {
          setConfirmPublish(null);
          void setPublished(true);
        }}
      />
    </div>
  );
}

function plural(n: number, one: string, many: string): string {
  return n === 0 ? `Sin ${many}` : `${n} ${n === 1 ? one : many}`;
}
