import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FileJson, KanbanSquare, Plus, Table2, Target } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, PageContainer, PageHeader, TableSkeleton } from "@/components/app";
import { Button } from "@/components/ui/button";
import { ConvertDialog } from "@/components/prospects/ConvertDialog";
import { ImportDialog } from "@/components/prospects/ImportDialog";
import { KanbanBoard } from "@/components/prospects/KanbanBoard";
import type { CardActions } from "@/components/prospects/ProspectCard";
import { ProspectSheet } from "@/components/prospects/ProspectSheet";
import { ProspectsTable } from "@/components/prospects/ProspectsTable";
import { useMoveProspect, useProspects, type Prospect } from "@/components/prospects/prospectsData";
import { BAJA_NOTICE, STATE_META, type ProspectState } from "@/lib/prospects/schema";
import { cn } from "@/lib/utils";

type View = "kanban" | "tabla";

export const Route = createFileRoute("/_app/pipeline")({
  head: () => ({ meta: [{ title: "Prospectos — Vibranding" }] }),
  validateSearch: (search: Record<string, unknown>): { vista?: "tabla" } =>
    search.vista === "tabla" ? { vista: "tabla" } : {},
  component: PipelinePage,
});

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const item = (value: View, label: string, Icon: typeof Table2) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-app-sm px-2.5 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        view === value ? "bg-surface text-foreground shadow-app-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon aria-hidden className="h-4 w-4" /> {label}
    </button>
  );
  return (
    <div role="group" aria-label="Vista" className="inline-flex rounded-app-md border border-border-subtle bg-surface-2 p-0.5">
      {item("kanban", "Kanban", KanbanSquare)}
      {item("tabla", "Tabla", Table2)}
    </div>
  );
}

function PipelinePage() {
  const { vista } = Route.useSearch();
  const view: View = vista === "tabla" ? "tabla" : "kanban";
  const navigate = useNavigate({ from: "/pipeline" });
  const prospectsQuery = useProspects();
  const move = useMoveProspect();
  const [editing, setEditing] = useState<{ open: boolean; prospect: Prospect | null }>({ open: false, prospect: null });
  const [importOpen, setImportOpen] = useState(false);
  const [converting, setConverting] = useState<Prospect | null>(null);

  const prospects = prospectsQuery.data ?? [];

  const onMove = (p: Prospect, estado: ProspectState) => {
    if (p.estado === "baja" && estado !== "baja") {
      toast.error(`${p.nombre} pidió la baja: no se puede volver a contactar. Si retiró la solicitud, un owner/admin puede revocarla desde la ficha del prospecto.`);
      return;
    }
    move.mutate(
      { prospect: p, estado },
      {
        onSuccess: () => {
          if (estado === "baja") toast.warning(BAJA_NOTICE, { duration: 10_000 });
          else if (estado === "ganado") {
            toast.success(`${p.nombre} pasó a Ganado`, {
              action: { label: "Convertir en cliente", onClick: () => setConverting({ ...p, estado }) },
            });
          } else if (estado === "frio") {
            toast.success(`${p.nombre} quedó en Fríos: no se le insistirá. Retómalo a mano cuando haga sentido.`);
          } else toast.success(`${p.nombre} → ${STATE_META[estado].label}`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo mover el prospecto"),
      },
    );
  };

  const actions: CardActions = {
    onOpen: (p) => setEditing({ open: true, prospect: p }),
    onMove,
    onConvert: (p) => setConverting(p),
  };

  const content = () => {
    if (prospectsQuery.isLoading) return <TableSkeleton rows={6} columns={5} label="Cargando prospectos" />;
    if (prospectsQuery.error) {
      return <ErrorState message={prospectsQuery.error.message} onRetry={() => void prospectsQuery.refetch()} />;
    }
    if (prospects.length === 0) {
      return (
        <EmptyState
          icon={Target}
          title="Aún no hay prospectos"
          description="Crea uno a mano o importa el archivo de prospectos de la oficina de agentes."
          action={<Button onClick={() => setImportOpen(true)}><FileJson aria-hidden className="mr-1 h-4 w-4" /> Importar JSON</Button>}
        />
      );
    }
    return view === "kanban" ? (
      <KanbanBoard prospects={prospects} actions={actions} />
    ) : (
      <ProspectsTable prospects={prospects} actions={actions} />
    );
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Prospectos"
        description="Embudo comercial: de nuevo a ganado. Arrastra las tarjetas o usa el selector de estado."
        actions={
          <>
            <ViewToggle view={view} onChange={(v) => void navigate({ search: v === "tabla" ? { vista: "tabla" } : {} })} />
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileJson aria-hidden className="mr-1 h-4 w-4" /> Importar JSON
            </Button>
            <Button onClick={() => setEditing({ open: true, prospect: null })}>
              <Plus aria-hidden className="mr-1 h-4 w-4" /> Nuevo prospecto
            </Button>
          </>
        }
      />
      {content()}
      <ProspectSheet
        open={editing.open}
        prospect={editing.prospect}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
        onConvert={(p) => { setEditing((s) => ({ ...s, open: false })); setConverting(p); }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} existing={prospects} />
      <ConvertDialog prospect={converting} onClose={() => setConverting(null)} />
    </PageContainer>
  );
}
