import { useState, type ReactNode } from "react";
import { Clock, FolderOpen } from "lucide-react";
import { EmptyState, ErrorState, FitList, ListSkeleton } from "@/components/app";
import { Button } from "@/components/ui/button";
import { byDateDesc, type ClientFile, type ClientUpload } from "./archivosModel";
import { useGeneratedFiles, useUploadedFiles } from "./archivosQueries";
import { DocumentRow, UploadRow } from "./FileItems";
import { FileViewer } from "./FileViewer";

/** Fila de "Recientes": generado por Vibranding o subido por el cliente. */
export type RecentEntry =
  | { key: string; date: string | null; origin: "vibranding"; file: ClientFile }
  | { key: string; date: string | null; origin: "cliente"; upload: ClientUpload };

/**
 * Todos los archivos del cliente (generados, subidos por la agencia y subidos por el
 * cliente) del más nuevo al más antiguo. `canEdit` habilita lo del onboarding.
 */
export function useRecentFiles(clientId: string, canEdit: boolean) {
  const generated = useGeneratedFiles(clientId);
  const uploaded = useUploadedFiles(clientId, canEdit);
  const entries: RecentEntry[] | undefined = generated.files
    ? [
        ...generated.files.map<RecentEntry>((file) => ({
          key: file.id,
          date: file.date,
          origin: "vibranding",
          file,
        })),
        ...uploaded.files.map<RecentEntry>((upload) => ({
          key: upload.key,
          date: upload.date,
          origin: "cliente",
          upload,
        })),
      ].sort(byDateDesc)
    : undefined;
  return {
    entries,
    isLoading: generated.isLoading || uploaded.isLoading,
    error: generated.error ?? uploaded.error,
    refetch: () => {
      generated.refetch();
      uploaded.refetch();
    },
  };
}

/** Fila de un archivo reciente, venga de donde venga. */
export function RecentRow({
  clientId,
  entry,
  onView,
  onDelete,
}: {
  clientId: string;
  entry: RecentEntry;
  onView: (file: ClientFile) => void;
  onDelete: (file: ClientFile) => void;
}) {
  if (entry.origin === "vibranding") {
    return (
      <DocumentRow
        file={entry.file}
        onView={() => onView(entry.file)}
        onDelete={() => onDelete(entry.file)}
      />
    );
  }
  const { upload } = entry;
  if (upload.source === "onboarding") {
    return <UploadRow clientId={clientId} file={upload.file} />;
  }
  return (
    <DocumentRow
      file={upload.file}
      onView={() => onView(upload.file)}
      onDelete={() => onDelete(upload.file)}
    />
  );
}

const MOBILE_LIST_PAGE = 10;

/** Contenedor de la lista: llena el alto libre en escritorio. */
function ListCard({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-app-lg border border-border-subtle bg-surface p-4 shadow-app-xs md:min-h-0 md:flex-1">
      {children}
    </section>
  );
}

interface ArchivosRecientesProps {
  clientId: string;
  canEdit: boolean;
  onDelete: (file: ClientFile) => void;
  onOpenFolders: () => void;
}

/** "Recientes": una sola lista con todo, ordenada por fecha. */
export function ArchivosRecientes({
  clientId,
  canEdit,
  onDelete,
  onOpenFolders,
}: ArchivosRecientesProps) {
  const recent = useRecentFiles(clientId, canEdit);
  const [viewing, setViewing] = useState<ClientFile | null>(null);

  if (recent.isLoading) return <ListSkeleton rows={6} label="Cargando archivos recientes" />;
  if (recent.error || !recent.entries) {
    return <ErrorState message={recent.error?.message} onRetry={recent.refetch} />;
  }

  return (
    <ListCard>
      {recent.entries.length === 0 ? (
        <EmptyState
          size="compact"
          icon={Clock}
          title="Aún no hay archivos"
          description="Aquí aparecerán, del más nuevo al más antiguo, las piezas, documentos y reportes del cliente y lo que él suba."
          action={
            <Button size="sm" variant="outline" onClick={onOpenFolders}>
              <FolderOpen aria-hidden className="mr-1.5 h-4 w-4" /> Ver carpetas
            </Button>
          }
        />
      ) : (
        <FitList
          items={recent.entries}
          getKey={(e) => e.key}
          label="Archivos recientes"
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(e) => (
            <RecentRow clientId={clientId} entry={e} onView={setViewing} onDelete={onDelete} />
          )}
        />
      )}
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </ListCard>
  );
}
