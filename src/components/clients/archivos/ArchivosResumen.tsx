import { useState, type ComponentType } from "react";
import { Clock, FileText, HardDrive, Images, Share2, Upload } from "lucide-react";
import { CompactStats, EmptyState, ErrorState, ListSkeleton, Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/clientFiles/clientFiles";
import { cn } from "@/lib/utils";
import { isGallery, type ClientFile } from "./archivosModel";
import { useStoredFiles } from "./archivosQueries";
import { RecentRow, useRecentFiles } from "./ArchivosRecientes";
import { FileViewer } from "./FileViewer";

/** Carpetas del cliente: galería, documentos y lo que subió el cliente. */
export type ArchivosFolder = "galeria" | "documentos" | "cliente";

const RECENT_LIMIT = 6;

interface FolderCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  count: number | null;
  hint: string;
  onOpen: () => void;
}

function FolderCard({ icon: Icon, title, count, hint, onOpen }: FolderCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "card-brand flex min-w-0 items-center gap-3 rounded-app-lg border border-border-subtle bg-surface p-4 text-left shadow-app-xs transition-colors hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-app-md bg-surface-2">
        <Icon aria-hidden className="h-5 w-5 text-brand-1" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="shrink-0 text-xl font-semibold tabular-nums">{count ?? "—"}</span>
    </button>
  );
}

interface ArchivosResumenProps {
  clientId: string;
  canEdit: boolean;
  /** Carpeta "Subidos por el cliente" visible (editores y el propio cliente). */
  showClientFolder: boolean;
  onDelete: (file: ClientFile) => void;
  onOpenFolder: (folder: ArchivosFolder) => void;
  onOpenRecent: () => void;
  onOpenShared: () => void;
}

/**
 * Resumen de Archivos: espacio usado (si el almacenamiento está disponible), contadores
 * por carpeta con acceso directo y los últimos archivos del cliente.
 */
export function ArchivosResumen({
  clientId,
  canEdit,
  showClientFolder,
  onDelete,
  onOpenFolder,
  onOpenRecent,
  onOpenShared,
}: ArchivosResumenProps) {
  const stored = useStoredFiles(clientId);
  const recent = useRecentFiles(clientId, canEdit);
  const [viewing, setViewing] = useState<ClientFile | null>(null);

  const generated = recent.entries?.filter((e) => e.origin === "vibranding") ?? null;
  const galleryCount = generated ? generated.filter((e) => isGallery(e.file)).length : null;
  const documentsCount = generated ? generated.filter((e) => !isGallery(e.file)).length : null;
  const clientCount = recent.entries
    ? recent.entries.filter((e) => e.origin === "cliente").length
    : null;
  const usage = stored.data?.available ? stored.data.usage : null;
  const total = recent.entries?.length ?? null;

  return (
    <>
      <CompactStats
        label="Resumen de archivos"
        className="shrink-0 grid-flow-row grid-cols-2 divide-x-0 md:grid-flow-col md:auto-cols-fr md:divide-x"
        items={[
          {
            key: "total",
            label: "Archivos",
            value: total ?? "—",
            hint: "Generados, subidos y reportes",
            icon: FileText,
            loading: recent.isLoading,
          },
          {
            key: "espacio",
            label: "Espacio usado",
            value: usage ? formatBytes(usage.used) : stored.isLoading ? "" : "—",
            hint: usage
              ? `de ${formatBytes(usage.limit)} disponibles`
              : "Solo cuenta lo subido en Archivos",
            icon: HardDrive,
            loading: stored.isLoading,
          },
          {
            key: "cliente",
            label: "Subidos por el cliente",
            value: showClientFolder ? (clientCount ?? "—") : "—",
            hint: showClientFolder ? "Onboarding y portal" : "Solo editores",
            icon: Upload,
            loading: showClientFolder && recent.isLoading,
          },
        ]}
      />

      <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
        <FolderCard
          icon={Images}
          title="Galería"
          count={galleryCount}
          hint="Posts, reels, historias, anuncios y piezas de marca"
          onOpen={() => onOpenFolder("galeria")}
        />
        <FolderCard
          icon={FileText}
          title="Documentos"
          count={documentsCount}
          hint="Reportes, PDF y documentos"
          onOpen={() => onOpenFolder("documentos")}
        />
        {showClientFolder ? (
          <FolderCard
            icon={Upload}
            title="Subidos por el cliente"
            count={clientCount}
            hint="Onboarding y portal del cliente"
            onOpen={() => onOpenFolder("cliente")}
          />
        ) : (
          <FolderCard
            icon={Share2}
            title="Compartidos con el cliente"
            count={null}
            hint="Enlaces de revisión y link de onboarding"
            onOpen={onOpenShared}
          />
        )}
      </div>

      <Panel
        fill
        title="Últimos archivos"
        icon={Clock}
        actions={
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onOpenRecent}>
            Ver todos
          </Button>
        }
      >
        {recent.isLoading ? (
          <ListSkeleton rows={4} label="Cargando últimos archivos" />
        ) : recent.error || !recent.entries ? (
          <ErrorState message={recent.error?.message} onRetry={recent.refetch} />
        ) : recent.entries.length === 0 ? (
          <EmptyState
            size="compact"
            icon={Clock}
            title="Aún no hay archivos"
            description="Las piezas, documentos y reportes aparecen aquí a medida que se generan; el cliente puede subir material con su link de onboarding."
            action={
              <Button size="sm" variant="outline" onClick={onOpenShared}>
                <Share2 aria-hidden className="mr-1.5 h-4 w-4" /> Ver compartidos
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border-subtle md:min-h-0 md:flex-1 md:overflow-y-auto">
            {recent.entries.slice(0, RECENT_LIMIT).map((entry) => (
              <li key={entry.key}>
                <RecentRow
                  clientId={clientId}
                  entry={entry}
                  onView={setViewing}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ul>
        )}
        <FileViewer file={viewing} onClose={() => setViewing(null)} />
      </Panel>
    </>
  );
}
