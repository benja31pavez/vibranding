import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, FileDown, Instagram, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/app";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { CLIENT_STATUS_META, isClientStatus, type FichaOverview } from "./fichaQueries";
import { usePdfExport } from "./usePdfExport";
import { MeetingBriefButton } from "./MeetingBriefDialog";
import { DeleteClientDialog, RenameClientDialog } from "./ClientDialogs";
import { useClientActions } from "./useClientActions";
import { EngagementChip } from "@/components/instagram/EngagementCard";

interface ClientHeaderProps {
  clientId: string;
  overview: FichaOverview | undefined;
}

export function ClientHeader({ clientId, overview }: ClientHeaderProps) {
  const { client, ig, reloadClient } = useActiveClient();
  const { renameClient, deleteClient } = useClientActions(clientId, reloadClient);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const pdf = usePdfExport();

  // Mientras se verifica el permiso, las acciones destructivas quedan deshabilitadas.
  const canEdit = overview?.canEdit ?? false;

  if (!client) return null;
  const avatar = ig.profile?.current_avatar_url;

  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-app-md bg-surface-2 text-lg font-semibold">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            client.name[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{client.name}</h1>
            {overview && <ClientStatusBadge status={overview.status} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {client.instagram_handle && (
              <a
                href={`https://instagram.com/${encodeURIComponent(client.instagram_handle)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Instagram aria-hidden className="h-3.5 w-3.5" /> @{client.instagram_handle}
              </a>
            )}
            <EngagementChip clientId={clientId} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link
            to="/clients/$clientId/portal-preview"
            params={{ clientId }}
            title="Muestra el portal tal como lo ve este cliente, en modo solo lectura"
          >
            <Eye aria-hidden className="mr-1.5 h-4 w-4" /> Vista previa del portal
          </Link>
        </Button>
        <MeetingBriefButton clientId={clientId} clientName={client.name} overview={overview} />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label="Más acciones">
              <MoreHorizontal aria-hidden className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={pdf.disabled} onSelect={pdf.run} title={pdf.title}>
              <FileDown aria-hidden className="mr-2 h-4 w-4" />
              {pdf.exporting ? "Generando…" : "Exportar PDF"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!canEdit && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Solo lectura: no puedes editar este cliente.
              </p>
            )}
            <DropdownMenuItem disabled={!canEdit} onSelect={() => setRenameOpen(true)}>
              <Pencil aria-hidden className="mr-2 h-4 w-4" /> Renombrar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canEdit}
              onSelect={() => setDeleteOpen(true)}
              className="text-danger-strong focus:text-danger-strong"
            >
              <Trash2 aria-hidden className="mr-2 h-4 w-4" /> Eliminar cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {pdf.node}

      <RenameClientDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        name={client.name}
        handle={client.instagram_handle}
        onSubmit={renameClient}
      />
      <DeleteClientDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        name={client.name}
        onConfirm={deleteClient}
      />
    </header>
  );
}

export function ClientStatusBadge({ status }: { status: string }) {
  const meta = isClientStatus(status) ? CLIENT_STATUS_META[status] : undefined;
  return <StatusBadge status={status} label={meta?.label} tone={meta?.tone} />;
}
