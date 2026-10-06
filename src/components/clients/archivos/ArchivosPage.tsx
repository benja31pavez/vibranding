import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { FileText, Images, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
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
import { CLIENT_FILE_ACCEPT, formatBytes } from "@/lib/clientFiles/clientFiles";
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
  type ClientUpload,
  type FileFilters,
} from "./archivosModel";
import {
  useDeleteClientFile,
  useGeneratedFiles,
  useStoredFiles,
  useUploadClientFiles,
  useUploadedFiles,
  type UploadOutcome,
} from "./archivosQueries";
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

/** Pide confirmación para eliminar un archivo propio. */
type RequestDelete = (file: ClientFile) => void;

function GeneratedView({ clientId, onDelete }: { clientId: string; onDelete: RequestDelete }) {
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
            renderItem={(f) => (
              <GalleryCard file={f} onView={() => setViewing(f)} onDelete={() => onDelete(f)} />
            )}
          />
        ) : (
          <FitList
            key="documents"
            items={shown}
            getKey={(f) => f.id}
            label="Documentos"
            defaultPageSize={MOBILE_LIST_PAGE}
            renderItem={(f) => (
              <DocumentRow file={f} onView={() => setViewing(f)} onDelete={() => onDelete(f)} />
            )}
          />
        )}
      </ListCard>
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function UploadedView({
  clientId,
  files,
  onDelete,
}: {
  clientId: string;
  files: ClientUpload[];
  onDelete: RequestDelete;
}) {
  const [viewing, setViewing] = useState<ClientFile | null>(null);
  return (
    <ListCard>
      {files.length === 0 ? (
        <EmptyState size="compact" icon={Upload} title="El cliente aún no ha subido archivos" />
      ) : (
        <FitList
          items={files}
          getKey={(u) => u.key}
          label="Subidos por el cliente"
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(u) =>
            u.source === "onboarding" ? (
              <UploadRow clientId={clientId} file={u.file} />
            ) : (
              <DocumentRow
                file={u.file}
                onView={() => setViewing(u.file)}
                onDelete={() => onDelete(u.file)}
              />
            )
          }
        />
      )}
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </ListCard>
  );
}

function uploadToasts(result: UploadOutcome) {
  if (result.uploaded > 0) {
    toast.success(result.uploaded === 1 ? "Archivo subido" : `${result.uploaded} archivos subidos`);
  }
  const [first, ...rest] = result.errors;
  if (!first) return;
  const more = rest.length > 0 ? ` (y ${rest.length} más)` : "";
  toast.error(`${first.name}: ${first.message}${more}`);
}

/** "Subir archivo": elige uno o varios y los sube con validación del servidor. */
function UploadButton({
  clientId,
  usage,
  onUploaded,
}: {
  clientId: string;
  usage: { used: number; limit: number };
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadClientFiles(clientId);
  const busy = upload.isPending;

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    upload.mutate(picked, {
      onSuccess: (result) => {
        uploadToasts(result);
        if (result.uploaded > 0) onUploaded();
      },
      onError: (err) => toast.error(err.message || "No pudimos subir los archivos"),
    });
  };

  const space = `${formatBytes(usage.used)} de ${formatBytes(usage.limit)}`;
  return (
    <>
      {usage.used > 0 && (
        <span
          className="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
          title="Espacio usado por este cliente"
        >
          {space}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={CLIENT_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onPick}
      />
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Imágenes, videos, PDF o documentos de hasta 200 MB"
      >
        {busy ? (
          <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Upload aria-hidden className="mr-1.5 h-4 w-4" />
        )}
        {busy ? "Subiendo…" : "Subir archivo"}
      </Button>
    </>
  );
}

/**
 * "Archivos" del cliente: piezas gráficas y documentos que generó (o subió)
 * Vibranding, y aparte lo que subió el cliente (en la plataforma y en el
 * onboarding). Cada usuario solo puede eliminar lo que subió su lado.
 */
export function ArchivosPage({ clientId }: { clientId: string }) {
  const overview = useFichaOverview(clientId);
  const canEdit = Boolean(overview.data?.canEdit);
  const stored = useStoredFiles(clientId);
  const actor = stored.data?.available ? stored.data.actor : null;
  const uploaded = useUploadedFiles(clientId, canEdit);
  const remove = useDeleteClientFile(clientId);
  const [origin, setOrigin] = useState<Origin>("vibranding");
  const [deleting, setDeleting] = useState<ClientFile | null>(null);
  // El usuario cliente también ve la pestaña con lo que subió.
  const showOrigins = canEdit || actor?.kind === "client";
  const active: Origin = showOrigins ? origin : "vibranding";

  const requestDelete: RequestDelete = (file) => {
    if (file.stored?.canDelete) setDeleting(file);
  };
  const confirmDelete = () => {
    const target = deleting?.stored;
    setDeleting(null);
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: () => toast.success("Archivo eliminado"),
      onError: (err) => toast.error(err.message || "No pudimos eliminar el archivo"),
    });
  };

  return (
    <FitPage
      header={
        <PageHeader
          size="compact"
          title="Archivos"
          actions={
            <>
              {actor?.canUpload && stored.data && (
                <UploadButton
                  clientId={clientId}
                  usage={stored.data.usage}
                  onUploaded={() => setOrigin(actor.kind === "client" ? "cliente" : "vibranding")}
                />
              )}
              {showOrigins && (
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
              )}
            </>
          }
        />
      }
      contentClassName="flex flex-col gap-3"
    >
      {active === "vibranding" ? (
        <GeneratedView clientId={clientId} onDelete={requestDelete} />
      ) : uploaded.isLoading ? (
        <ListSkeleton rows={3} label="Cargando archivos del cliente" />
      ) : uploaded.error ? (
        <ErrorState message={uploaded.error.message} onRetry={uploaded.refetch} />
      ) : (
        <UploadedView clientId={clientId} files={uploaded.files} onDelete={requestDelete} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar este archivo?"
        description={
          deleting ? `"${deleting.name}" se borrará para todos y no se puede recuperar.` : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirmDelete}
      />
    </FitPage>
  );
}
