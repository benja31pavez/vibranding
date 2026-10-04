import { useState } from "react";
import { ExternalLink, Instagram, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Money, StatusBadge } from "@/components/app";
import { findPlan } from "@/lib/pricing/plans";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { CLIENT_STATUS_META, formatDate, isClientStatus, type FichaOverview } from "./fichaQueries";
import { ExportPdfButton } from "./ExportPdfButton";
import { DeleteClientDialog, RenameClientDialog } from "./ClientDialogs";
import { useClientActions } from "./useClientActions";

interface ClientHeaderProps {
  clientId: string;
  overview: FichaOverview | undefined;
  loading: boolean;
}

export function ClientHeader({ clientId, overview, loading }: ClientHeaderProps) {
  const { client, ig, reloadClient } = useActiveClient();
  const { renameClient, deleteClient } = useClientActions(clientId, reloadClient);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!client) return null;
  const avatar = ig.profile?.current_avatar_url;

  return (
    <header className="flex flex-col gap-4 rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-app-lg bg-surface-2 text-xl font-semibold">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : client.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{client.name}</h1>
            {overview && <ClientStatusBadge status={overview.status} />}
          </div>
          {client.instagram_handle && (
            <a
              href={`https://instagram.com/${encodeURIComponent(client.instagram_handle)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Instagram aria-hidden className="h-3.5 w-3.5" /> @{client.instagram_handle}
            </a>
          )}
          <HeaderFacts overview={overview} loading={loading} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href="/portal" target="_blank" rel="noreferrer" title="Abre el portal en otra pestaña (se ve con la cuenta del cliente)">
            <ExternalLink aria-hidden className="mr-1.5 h-4 w-4" /> Abrir portal
          </a>
        </Button>
        <ExportPdfButton />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label="Más acciones">
              <MoreHorizontal aria-hidden className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil aria-hidden className="mr-2 h-4 w-4" /> Renombrar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-danger-strong focus:text-danger-strong">
              <Trash2 aria-hidden className="mr-2 h-4 w-4" /> Eliminar cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RenameClientDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        name={client.name}
        handle={client.instagram_handle}
        onSubmit={renameClient}
      />
      <DeleteClientDialog open={deleteOpen} onOpenChange={setDeleteOpen} name={client.name} onConfirm={deleteClient} />
    </header>
  );
}

export function ClientStatusBadge({ status }: { status: string }) {
  const meta = isClientStatus(status) ? CLIENT_STATUS_META[status] : undefined;
  return <StatusBadge status={status} label={meta?.label} tone={meta?.tone} />;
}

function HeaderFacts({ overview, loading }: { overview: FichaOverview | undefined; loading: boolean }) {
  if (loading) return <Skeleton className="h-4 w-64" />;
  if (!overview) return null;
  const plan = findPlan(overview.billing?.plan_key);
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <Fact label="Plan">{plan?.label ?? "Sin plan"}</Fact>
      <Fact label="MRR">
        <Money amount={overview.billing?.mrr ?? 0} className="text-foreground" />
      </Fact>
      <Fact label="Cliente desde">{formatDate(overview.startedAt)}</Fact>
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <dt>{label}:</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}
