import { useState } from "react";
import { FileText, FolderUp, Images } from "lucide-react";
import { FitList, FitPage, PageHeader, Panel } from "@/components/app";
import type { PanelFile, PanelFiles } from "@/lib/client-panel/model";
import { cn } from "@/lib/utils";
import { PanelDocumentRow, PanelFileViewer, PanelGalleryCard } from "./PanelFileItems";
import { PanelSectionState } from "./PanelSectionState";
import { usePanelFiles } from "./usePanelData";

type Tab = "generated" | "documents" | "mine";

const TABS: readonly { value: Tab; label: string; icon: typeof Images; empty: string }[] = [
  {
    value: "generated",
    label: "Generados por Vibranding",
    icon: Images,
    empty: "Aún no hay piezas entregadas.",
  },
  { value: "documents", label: "Documentos", icon: FileText, empty: "Aún no hay documentos." },
  { value: "mine", label: "Subidos por mí", icon: FolderUp, empty: "Aún no has subido archivos." },
];

/** Ancho mínimo de una tarjeta de la galería (px). */
const CARD_MIN_WIDTH = 160;
const MAX_COLS = 6;
const MOBILE_GALLERY_PAGE = 6;
const MOBILE_LIST_PAGE = 8;

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
      <PanelSectionState query={query} title="No pudimos cargar tus archivos">
        {(files) => <FilesBrowser files={files} />}
      </PanelSectionState>
    </FitPage>
  );
}

function FilesBrowser({ files }: { files: PanelFiles }) {
  const [tab, setTab] = useState<Tab>("generated");
  const [viewing, setViewing] = useState<PanelFile | null>(null);
  const current = TABS.find((t) => t.value === tab) ?? TABS[0];
  const items = files[tab];

  return (
    <Panel
      fill
      className="md:min-h-0 md:flex-1"
      bodyClassName="flex flex-col gap-3 md:min-h-0"
      title={
        <div role="tablist" aria-label="Tipo de archivo" className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const selected = t.value === tab;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-app-md px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-brand-soft text-brand-1"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
                {t.label}
                <span className="tabular-nums text-xs opacity-70">{files[t.value].length}</span>
              </button>
            );
          })}
        </div>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{current.empty}</p>
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
          renderItem={(f) => <PanelGalleryCard file={f} onView={() => setViewing(f)} />}
        />
      ) : (
        <FitList
          key={tab}
          items={items}
          getKey={(f) => f.id}
          label={current.label}
          divided
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(f) => <PanelDocumentRow file={f} onView={() => setViewing(f)} />}
        />
      )}
      <PanelFileViewer file={viewing} onClose={() => setViewing(null)} />
    </Panel>
  );
}
