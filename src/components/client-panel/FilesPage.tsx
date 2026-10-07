import { useState } from "react";
import { FileText, FolderUp, Images, Search } from "lucide-react";
import {
  FilesEmpty,
  FilterChips,
  FitList,
  FitPage,
  GallerySkeleton,
  PageHeader,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FILE_KIND_LABEL,
  type PanelFile,
  type PanelFileKind,
  type PanelFiles,
} from "@/lib/client-panel/model";
import { cn } from "@/lib/utils";
import { PanelDocumentRow, PanelFileViewer, PanelGalleryCard } from "./PanelFileItems";
import { isPanelViewable } from "./panelFiles";
import { PanelSectionState } from "./PanelSectionState";
import { usePanelFiles } from "./usePanelData";

type Tab = "generated" | "documents" | "mine";

const TABS: readonly {
  value: Tab;
  label: string;
  /** Etiqueta en móvil, para que las tres pestañas quepan. */
  short: string;
  icon: typeof Images;
  empty: string;
  hint: string;
}[] = [
  {
    value: "generated",
    label: "Generados por Vibranding",
    short: "Vibranding",
    icon: Images,
    empty: "Aún no hay piezas entregadas",
    hint: "Aquí aparecen tus posts, reels, historias y anuncios cuando se aprueban o publican.",
  },
  {
    value: "documents",
    label: "Documentos",
    short: "Documentos",
    icon: FileText,
    empty: "Aún no hay documentos",
    hint: "Aquí quedan los reportes que te enviamos, los PDF y los documentos de Office.",
  },
  {
    value: "mine",
    label: "Subidos por mí",
    short: "Míos",
    icon: FolderUp,
    empty: "Aún no has subido archivos",
    hint: "Lo que compartas con Vibranding (logos, fotos, documentos) aparece aquí.",
  },
];

/** Orden de los chips de tipo en la galería. */
const KIND_ORDER: readonly PanelFileKind[] = [
  "post",
  "carousel",
  "story",
  "reel",
  "ad",
  "brand",
  "upload",
  "other",
];

/** Ancho mínimo de una tarjeta de la galería (px). */
const CARD_MIN_WIDTH = 168;
const MAX_COLS = 7;
const MOBILE_GALLERY_PAGE = 6;
const MOBILE_LIST_PAGE = 8;

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Archivos del cliente en solo lectura: lo que entregó Vibranding, los
 * documentos (reportes enviados, PDF) y lo que subió el cliente. Las URLs
 * vienen firmadas por el servidor (1 hora). Subir y eliminar llegan después.
 */
export function FilesPage() {
  const query = usePanelFiles();
  return (
    <FitPage
      header={<PageHeader size="compact" title="Archivos" />}
      contentClassName="flex flex-col"
    >
      <PanelSectionState
        query={query}
        title="No pudimos cargar tus archivos"
        skeleton={<GallerySkeleton count={12} label="Cargando tus archivos" />}
      >
        {(files) => <FilesBrowser files={files} />}
      </PanelSectionState>
    </FitPage>
  );
}

function TabBar({ tab, onTab, files }: { tab: Tab; onTab: (t: Tab) => void; files: PanelFiles }) {
  return (
    <div
      role="tablist"
      aria-label="Tipo de archivo"
      className="flex gap-1 max-sm:-mx-1 max-sm:overflow-x-auto max-sm:px-1"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const selected = t.value === tab;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onTab(t.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-app-md px-3 py-1.5 text-sm font-medium motion-safe:transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-brand-soft text-foreground"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className={cn("h-4 w-4", selected && "text-brand-1")} />
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
            <span
              className={cn(
                "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                selected ? "bg-surface text-brand-1" : "bg-surface-2",
              )}
            >
              {files[t.value].length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FilesBrowser({ files }: { files: PanelFiles }) {
  const [tab, setTab] = useState<Tab>("generated");
  const [kind, setKind] = useState<PanelFileKind | "all">("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const current = TABS.find((t) => t.value === tab) ?? TABS[0];
  const pool = files[tab];
  const q = normalize(search);
  const items = pool.filter(
    (f) =>
      (tab !== "generated" || kind === "all" || f.kind === kind) &&
      (!q || normalize(f.name).includes(q)),
  );
  const viewable = items.filter(isPanelViewable);
  const openIndex = viewable.findIndex((f) => f.id === openId);
  const open = (f: PanelFile) => setOpenId(f.id);

  const counts = new Map<PanelFileKind, number>();
  for (const f of files.generated) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  const kindOptions = [
    { value: "all" as const, label: "Todo", count: files.generated.length },
    ...KIND_ORDER.filter((k) => counts.has(k)).map((k) => ({
      value: k,
      label: FILE_KIND_LABEL[k],
      count: counts.get(k) ?? 0,
    })),
  ];
  const filtered = Boolean(q) || (tab === "generated" && kind !== "all");
  const changeTab = (next: Tab) => {
    setTab(next);
    setKind("all");
  };

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-app-lg border border-border-subtle bg-surface p-3 shadow-app-xs sm:p-4 md:min-h-0 md:flex-1">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <TabBar tab={tab} onTab={changeTab} files={files} />
        {pool.length > 0 && (
          <div className="relative w-full sm:ml-auto sm:w-56">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar archivos por nombre"
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}
      </div>
      {tab === "generated" && kindOptions.length > 2 && (
        <FilterChips
          label="Tipo de pieza"
          value={kind}
          options={kindOptions}
          onChange={setKind}
          className="shrink-0 max-sm:-mx-3 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-3 max-sm:pb-1"
        />
      )}
      {items.length === 0 ? (
        filtered ? (
          <FilesEmpty
            title="Nada coincide con tu búsqueda"
            description="Prueba con otro tipo u otra palabra."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setKind("all");
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <FilesEmpty title={current.empty} description={current.hint} />
        )
      ) : tab === "generated" ? (
        <FitList
          key="generated"
          variant="grid"
          items={items}
          getKey={(f) => f.id}
          label={current.label}
          minColWidth={CARD_MIN_WIDTH}
          maxCols={MAX_COLS}
          defaultPageSize={MOBILE_GALLERY_PAGE}
          mobileGridClassName="grid-cols-2 sm:grid-cols-3"
          renderItem={(f, { inSheet }) =>
            inSheet ? (
              <PanelDocumentRow file={f} compact onView={() => open(f)} />
            ) : (
              <PanelGalleryCard file={f} onView={() => open(f)} />
            )
          }
        />
      ) : (
        <FitList
          key={tab}
          items={items}
          getKey={(f) => f.id}
          label={current.label}
          divided={false}
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(f) => <PanelDocumentRow file={f} onView={() => open(f)} />}
        />
      )}
      {files.truncated && (
        <p className="shrink-0 text-xs text-muted-foreground">Se muestran los más recientes.</p>
      )}
      <PanelFileViewer
        files={viewable}
        index={openIndex >= 0 ? openIndex : null}
        onIndexChange={(i) => setOpenId(viewable[i]?.id ?? null)}
        onClose={() => setOpenId(null)}
      />
    </section>
  );
}
