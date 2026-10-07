import { useState, type ReactNode } from "react";
import { Lock, Search } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  ErrorState,
  FileLightbox,
  FilesEmpty,
  FitList,
  FitPage,
  GallerySkeleton,
  ListSkeleton,
  PageHeader,
  StorageMeter,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/clientFiles/clientFiles";
import { useFichaOverview } from "../ficha/fichaQueries";
import {
  downloadHref,
  EMPTY_FILTERS,
  isGallery,
  isViewable,
  kindCounts,
  kindsOf,
  matchesFilters,
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
import { Segmented, Toolbar, type View } from "./ArchivosToolbar";
import { DocumentRow, FileMeta, GalleryCard, UploadRow } from "./FileItems";
import { DropZone, UploadButton, UploadProgressBar } from "./UploadControls";

type Origin = "vibranding" | "cliente";

/** Móvil (sin medir): tarjetas y filas por página. */
const MOBILE_GALLERY_PAGE = 6;
const MOBILE_LIST_PAGE = 8;
/** Ancho mínimo de una tarjeta de la galería (px). */
const CARD_MIN_WIDTH = 168;
const MAX_COLS = 7;
const MAX_FILE_HINT = "Hasta 200 MB por archivo";

/** Contenedor de la lista: llena el alto libre en escritorio. */
function ListCard({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-app-lg border border-border-subtle bg-surface p-3 shadow-app-xs sm:p-4 md:h-full md:min-h-0">
      {children}
    </section>
  );
}

/** Pide confirmación para eliminar un archivo propio. */
type RequestDelete = (file: ClientFile) => void;

/** Visor sobre una lista: abre por id y navega entre los archivos visibles. */
function useLightbox(files: readonly ClientFile[]) {
  const items = files.filter(isViewable);
  const [openId, setOpenId] = useState<string | null>(null);
  const found = items.findIndex((f) => f.id === openId);
  const index = found >= 0 ? found : null;
  return {
    open: (file: ClientFile) => setOpenId(file.id),
    element: (
      <FileLightbox
        items={items}
        index={index}
        onIndexChange={(i) => setOpenId(items[i]?.id ?? null)}
        onClose={() => setOpenId(null)}
        renderMeta={(f) => <FileMeta file={f} />}
        downloadHref={downloadHref}
      />
    ),
  };
}

function GeneratedEmpty({
  filtered,
  view,
  onClear,
}: {
  filtered: boolean;
  view: View;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <FilesEmpty
        title="Nada coincide con los filtros"
        description="Prueba con otro tipo, otro mes u otra palabra."
        action={
          <Button size="sm" variant="outline" onClick={onClear}>
            <Search aria-hidden className="mr-1.5 h-4 w-4" /> Limpiar filtros
          </Button>
        }
      />
    );
  }
  return view === "gallery" ? (
    <FilesEmpty
      title="Aún no hay piezas gráficas"
      description="Los posts, reels, historias y anuncios aparecen aquí cuando se aprueban o publican."
    />
  ) : (
    <FilesEmpty
      title="Aún no hay documentos"
      description="Aquí quedan los reportes enviados, los PDF y los documentos de Office."
    />
  );
}

function GeneratedView({
  clientId,
  onDelete,
  upload,
}: {
  clientId: string;
  onDelete: RequestDelete;
  /** Botón para el estado vacío (solo si el usuario puede subir). */
  upload: ReactNode;
}) {
  const { files, isLoading, error, refetch } = useGeneratedFiles(clientId);
  const [view, setView] = useState<View>("gallery");
  const [filters, setFilters] = useState<FileFilters>(EMPTY_FILTERS);
  const all = files ?? [];
  const gallery = all.filter(isGallery);
  const documents = all.filter((f) => !isGallery(f));
  const pool = view === "gallery" ? gallery : documents;
  const shown = pool.filter((f) => matchesFilters(f, filters));
  const lightbox = useLightbox(shown);

  if (isLoading) {
    return (
      <ListCard>
        <GallerySkeleton count={12} label="Cargando archivos" />
      </ListCard>
    );
  }
  if (error || !files) return <ErrorState message={error?.message} onRetry={refetch} />;

  if (all.length === 0) {
    return (
      <ListCard>
        <FilesEmpty
          className={
            upload ? "rounded-app-lg border-2 border-dashed border-border-subtle" : undefined
          }
          title="Aún no hay archivos de este cliente"
          description="Aquí aparecen los posts aprobados o publicados, las creatividades de anuncios, los entregables, los reportes enviados y lo que subas. También puedes arrastrar archivos aquí."
          action={upload}
        />
      </ListCard>
    );
  }

  const filtered = Boolean(
    filters.kind !== "all" || filters.month !== "all" || filters.query.trim(),
  );
  const counts = kindCounts(gallery);
  const changeView = (next: View) => {
    setView(next);
    setFilters({ ...EMPTY_FILTERS, query: filters.query });
  };

  return (
    <ListCard>
      <Toolbar
        view={view}
        onView={changeView}
        counts={{ gallery: gallery.length, documents: documents.length }}
        kinds={kindsOf(gallery).map((kind) => ({ kind, count: counts[kind] ?? 0 }))}
        months={monthsOf(pool)}
        filters={filters}
        onFilters={setFilters}
      />
      {shown.length === 0 ? (
        <GeneratedEmpty filtered={filtered} view={view} onClear={() => setFilters(EMPTY_FILTERS)} />
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
          renderItem={(f, { inSheet }) =>
            inSheet ? (
              <DocumentRow
                file={f}
                compact
                onView={() => lightbox.open(f)}
                onDelete={() => onDelete(f)}
              />
            ) : (
              <GalleryCard file={f} onView={() => lightbox.open(f)} onDelete={() => onDelete(f)} />
            )
          }
        />
      ) : (
        <FitList
          key="documents"
          items={shown}
          getKey={(f) => f.id}
          label="Documentos"
          divided={false}
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(f) => (
            <DocumentRow file={f} onView={() => lightbox.open(f)} onDelete={() => onDelete(f)} />
          )}
        />
      )}
      {lightbox.element}
    </ListCard>
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
  const stored = files.flatMap((u) => (u.source === "archivos" ? [u.file] : []));
  const lightbox = useLightbox(stored);
  return (
    <ListCard>
      {files.length === 0 ? (
        <FilesEmpty
          title="El cliente aún no ha subido archivos"
          description="Lo que suba desde su panel o en el onboarding (logos, fotos, documentos) aparece aquí."
        />
      ) : (
        <FitList
          items={files}
          getKey={(u) => u.key}
          label="Subidos por el cliente"
          divided={false}
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(u) =>
            u.source === "onboarding" ? (
              <UploadRow clientId={clientId} file={u.file} />
            ) : (
              <DocumentRow
                file={u.file}
                onView={() => lightbox.open(u.file)}
                onDelete={() => onDelete(u.file)}
              />
            )
          }
        />
      )}
      {lightbox.element}
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

/** Quién puede eliminar qué, dicho en la pestaña activa. */
function deleteRuleText(origin: Origin, author: "agency" | "client" | null): string {
  if (origin === "vibranding") {
    return author === "agency"
      ? "Puedes eliminar solo lo que subió Vibranding"
      : "Solo Vibranding puede eliminar estos archivos";
  }
  return author === "client"
    ? "Puedes eliminar solo lo que subiste tú"
    : "Solo el cliente puede eliminar lo que subió";
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
  const usage = stored.data?.available ? stored.data.usage : null;
  const uploaded = useUploadedFiles(clientId, canEdit);
  const remove = useDeleteClientFile(clientId);
  const upload = useUploadClientFiles(clientId);
  const [origin, setOrigin] = useState<Origin>("vibranding");
  const [deleting, setDeleting] = useState<ClientFile | null>(null);
  // El usuario cliente también ve la pestaña con lo que subió.
  const showOrigins = canEdit || actor?.kind === "client";
  const active: Origin = showOrigins ? origin : "vibranding";
  const canUpload = Boolean(actor?.canUpload);
  const busy = upload.isPending;

  const startUpload = (files: File[]) => {
    if (!actor?.canUpload || busy) return;
    upload.mutate(files, {
      onSuccess: (result) => {
        uploadToasts(result);
        if (result.uploaded > 0) setOrigin(actor.kind === "client" ? "cliente" : "vibranding");
      },
      onError: (err) => toast.error(err.message || "No pudimos subir los archivos"),
    });
  };

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
            canUpload ? (
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                {usage && (
                  <StorageMeter
                    used={usage.used}
                    limit={usage.limit}
                    usedLabel={usage.used > 0 ? formatBytes(usage.used) : "0 MB"}
                    limitLabel={formatBytes(usage.limit)}
                    className="min-w-40 flex-1 sm:w-48 sm:flex-none"
                  />
                )}
                <UploadButton busy={busy} onFiles={startUpload} />
              </div>
            ) : undefined
          }
        />
      }
      contentClassName="flex flex-col gap-3"
    >
      {(showOrigins || canUpload) && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
            <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span>
              {deleteRuleText(active, actor?.author ?? null)}
              {canUpload && <span className="hidden lg:inline"> · {MAX_FILE_HINT}</span>}
            </span>
          </p>
        </div>
      )}
      <UploadProgressBar progress={upload.progress} />
      <DropZone
        enabled={canUpload}
        busy={busy}
        onFiles={startUpload}
        className="flex min-w-0 flex-col md:min-h-0 md:flex-1"
      >
        {active === "vibranding" ? (
          <GeneratedView
            clientId={clientId}
            onDelete={requestDelete}
            upload={
              canUpload ? (
                <UploadButton busy={busy} onFiles={startUpload} variant="outline" />
              ) : null
            }
          />
        ) : uploaded.isLoading ? (
          <ListCard>
            <ListSkeleton rows={5} label="Cargando archivos del cliente" />
          </ListCard>
        ) : uploaded.error ? (
          <ErrorState message={uploaded.error.message} onRetry={uploaded.refetch} />
        ) : (
          <UploadedView clientId={clientId} files={uploaded.files} onDelete={requestDelete} />
        )}
      </DropZone>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar este archivo?"
        description={
          deleting
            ? `"${deleting.name}" se borrará para todos y no se puede recuperar. Su espacio queda libre.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirmDelete}
      />
    </FitPage>
  );
}
