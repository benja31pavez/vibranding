import { useState, type ReactNode } from "react";
import { FileText, Images, Search, Upload } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  FitList,
  FitPage,
  ListSkeleton,
  PageHeader,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFichaOverview } from "../ficha/fichaQueries";
import {
  EMPTY_FILTERS,
  isGallery,
  KIND_LABEL,
  kindsOf,
  matchesFilters,
  monthOptionLabel,
  monthsOf,
  type ClientFile,
  type FileFilters,
  type UploadedFile,
} from "./archivosModel";
import { useGeneratedFiles, useUploadedFiles } from "./archivosQueries";
import { DocumentRow, GalleryCard, UploadRow } from "./FileItems";
import { FileViewer } from "./FileViewer";

type Origin = "vibranding" | "cliente";
type View = "gallery" | "documents";

/** Móvil (sin medir): tarjetas y filas por página. */
const MOBILE_GALLERY_PAGE = 6;
const MOBILE_LIST_PAGE = 8;
/** Ancho mínimo de una tarjeta de la galería (px). */
const CARD_MIN_WIDTH = 160;
const MAX_COLS = 6;

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Control segmentado (misma línea que "Trabajo del mes"). */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex shrink-0 gap-1 rounded-app-md bg-surface-2 p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-app-sm px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            o.value === value
              ? "bg-surface text-foreground shadow-app-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && (
            <span className="rounded-full bg-surface-2 px-1.5 tabular-nums">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-transparent bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-border-subtle text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Contenedor de la lista: llena el alto libre en escritorio. */
function ListCard({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs md:min-h-0 md:flex-1">
      {children}
    </section>
  );
}

function Toolbar({
  view,
  onView,
  counts,
  kinds,
  months,
  filters,
  onFilters,
}: {
  view: View;
  onView: (v: View) => void;
  counts: Record<View, number>;
  kinds: ReturnType<typeof kindsOf>;
  months: string[];
  filters: FileFilters;
  onFilters: (f: FileFilters) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Vista"
          value={view}
          onChange={onView}
          options={[
            { value: "gallery", label: "Galería", count: counts.gallery },
            { value: "documents", label: "Documentos", count: counts.documents },
          ]}
        />
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          {months.length > 1 && (
            <Select
              value={filters.month}
              onValueChange={(month) => onFilters({ ...filters, month })}
            >
              <SelectTrigger className="h-8 w-[168px] text-xs" aria-label="Mes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthOptionLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={filters.query}
              onChange={(e) => onFilters({ ...filters, query: e.target.value })}
              placeholder="Buscar por nombre"
              aria-label="Buscar archivos por nombre"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>
      {view === "gallery" && kinds.length > 1 && (
        <div
          role="group"
          aria-label="Tipo de pieza"
          className="flex flex-wrap items-center gap-1.5"
        >
          <Chip
            active={filters.kind === "all"}
            onClick={() => onFilters({ ...filters, kind: "all" })}
          >
            Todo
          </Chip>
          {kinds.map((k) => (
            <Chip
              key={k}
              active={filters.kind === k}
              onClick={() => onFilters({ ...filters, kind: k })}
            >
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function GeneratedView({ clientId }: { clientId: string }) {
  const { files, isLoading, error, refetch } = useGeneratedFiles(clientId);
  const [view, setView] = useState<View>("gallery");
  const [filters, setFilters] = useState<FileFilters>(EMPTY_FILTERS);
  const [viewing, setViewing] = useState<ClientFile | null>(null);

  if (isLoading) return <ListSkeleton rows={4} label="Cargando archivos" />;
  if (error || !files) return <ErrorState message={error?.message} onRetry={refetch} />;

  const gallery = files.filter(isGallery);
  const documents = files.filter((f) => !isGallery(f));
  const pool = view === "gallery" ? gallery : documents;
  const shown = pool.filter((f) => matchesFilters(f, filters));
  const filtered = filters.kind !== "all" || filters.month !== "all" || filters.query.trim();

  const changeView = (next: View) => {
    setView(next);
    setFilters({ ...EMPTY_FILTERS, query: filters.query });
  };

  return (
    <>
      <Toolbar
        view={view}
        onView={changeView}
        counts={{ gallery: gallery.length, documents: documents.length }}
        kinds={kindsOf(gallery)}
        months={monthsOf(pool)}
        filters={filters}
        onFilters={setFilters}
      />
      <ListCard>
        {shown.length === 0 ? (
          filtered ? (
            <EmptyState
              size="compact"
              icon={Search}
              title="Nada coincide con los filtros"
              action={
                <Button size="sm" variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : view === "gallery" ? (
            <EmptyState size="compact" icon={Images} title="Aún no hay piezas gráficas" />
          ) : (
            <EmptyState size="compact" icon={FileText} title="Aún no hay documentos" />
          )
        ) : view === "gallery" ? (
          <FitList
            key="gallery"
            variant="grid"
            items={shown}
            getKey={(f) => f.id}
            label="Piezas gráficas"
            minColWidth={CARD_MIN_WIDTH}
            maxCols={MAX_COLS}
            defaultPageSize={MOBILE_GALLERY_PAGE}
            mobileGridClassName="grid-cols-2 sm:grid-cols-3"
            renderItem={(f) => <GalleryCard file={f} onView={() => setViewing(f)} />}
          />
        ) : (
          <FitList
            key="documents"
            items={shown}
            getKey={(f) => f.id}
            label="Documentos"
            defaultPageSize={MOBILE_LIST_PAGE}
            renderItem={(f) => <DocumentRow file={f} onView={() => setViewing(f)} />}
          />
        )}
      </ListCard>
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function UploadedView({ clientId, files }: { clientId: string; files: UploadedFile[] }) {
  return (
    <ListCard>
      {files.length === 0 ? (
        <EmptyState size="compact" icon={Upload} title="El cliente aún no ha subido archivos" />
      ) : (
        <FitList
          items={files}
          getKey={(f) => f.path}
          label="Subidos por el cliente"
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(f) => <UploadRow clientId={clientId} file={f} />}
        />
      )}
    </ListCard>
  );
}

/**
 * "Archivos" del cliente: piezas gráficas y documentos que generó Vibranding,
 * y aparte lo que el cliente subió en el onboarding (solo para el equipo).
 */
export function ArchivosPage({ clientId }: { clientId: string }) {
  const overview = useFichaOverview(clientId);
  const canEdit = Boolean(overview.data?.canEdit);
  const uploaded = useUploadedFiles(clientId, canEdit);
  const [origin, setOrigin] = useState<Origin>("vibranding");
  const active: Origin = canEdit ? origin : "vibranding";

  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Archivos"
          actions={
            canEdit && (
              <Segmented
                label="Origen de los archivos"
                value={active}
                onChange={setOrigin}
                options={[
                  { value: "vibranding", label: "Generados por Vibranding" },
                  {
                    value: "cliente",
                    label: "Subidos por el cliente",
                    count: uploaded.files.length,
                  },
                ]}
              />
            )
          }
        />
      }
      contentClassName="flex flex-col gap-3"
    >
      {active === "vibranding" ? (
        <GeneratedView clientId={clientId} />
      ) : uploaded.isLoading ? (
        <ListSkeleton rows={3} label="Cargando archivos del cliente" />
      ) : uploaded.error ? (
        <ErrorState message={uploaded.error.message} onRetry={uploaded.refetch} />
      ) : (
        <UploadedView clientId={clientId} files={uploaded.files} />
      )}
    </FitPage>
  );
}
