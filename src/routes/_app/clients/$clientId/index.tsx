import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { ErrorState, ListSkeleton, Panel } from "@/components/app";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClientAccessCard } from "@/components/clients/ClientAccessCard";
import { ClientHeader } from "@/components/clients/ficha/ClientHeader";
import { BillingCard } from "@/components/clients/ficha/BillingCard";
import { OnboardingLinkPanel } from "@/components/clients/ficha/OnboardingLinkPanel";
import { HealthCards } from "@/components/clients/ficha/HealthCards";
import { PendingApprovalPanel, UpcomingContentPanel } from "@/components/clients/ficha/MainPanels";
import { ContractPanel } from "@/components/clients/ficha/ContractPanel";
import { ReportsPanel } from "@/components/clients/ficha/ReportsPanel";
import { PERMISSION_DENIED_MSG, useFichaHealth, useFichaOverview } from "@/components/clients/ficha/fichaQueries";

export const Route = createFileRoute("/_app/clients/$clientId/")({
  component: ClientFichaPage,
});

function ClientFichaPage() {
  const { clientId } = Route.useParams();
  const { client, reloadClient } = useActiveClient();
  const overview = useFichaOverview(clientId);
  const health = useFichaHealth(clientId);

  return (
    <div className="space-y-6">
      <ClientHeader clientId={clientId} overview={overview.data} loading={overview.isLoading} />

      {health.error && !health.isLoading ? (
        <ErrorState message={health.error.message} onRetry={() => void health.refetch()} retrying={health.isFetching} />
      ) : (
        <HealthCards clientId={clientId} health={health.data} loading={health.isLoading} />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PendingApprovalPanel
            clientId={clientId}
            health={health.data}
            loading={health.isLoading}
            error={health.error}
            onRetry={() => void health.refetch()}
          />
          <UpcomingContentPanel clientId={clientId} />
          <ReportsPanel clientId={clientId} clientName={client?.name ?? ""} canEdit={overview.data?.canEdit ?? false} />
          <BusinessDescription
            clientId={clientId}
            value={client?.business_description ?? ""}
            onSaved={reloadClient}
          />
        </div>

        <aside className="space-y-6" aria-label="Facturación, contrato y accesos">
          {overview.isLoading ? (
            <Panel title="Plan y facturación">
              <ListSkeleton rows={4} label="Cargando facturación" />
            </Panel>
          ) : overview.error ? (
            <ErrorState
              message={overview.error.message}
              onRetry={() => void overview.refetch()}
              retrying={overview.isFetching}
            />
          ) : overview.data ? (
            <>
              <BillingCard clientId={clientId} overview={overview.data} />
              <OnboardingLinkPanel clientId={clientId} overview={overview.data} />
            </>
          ) : null}
          <ContractPanel clientId={clientId} />
          <ClientAccessCard clientId={clientId} />
        </aside>
      </div>
    </div>
  );
}

function BusinessDescription({
  clientId,
  value,
  onSaved,
}: {
  clientId: string;
  value: string;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .update({ business_description: draft.trim() || null })
      .eq("id", clientId)
      .select("id");
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
    if (!data || data.length === 0) {
      toast.error(PERMISSION_DENIED_MSG);
      return;
    }
    await onSaved();
    setEditing(false);
    toast.success("Descripción guardada");
  };

  const actions = !editing ? (
    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
      <Pencil aria-hidden className="mr-1 h-3.5 w-3.5" /> Editar
    </Button>
  ) : (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Cancelar"
        onClick={() => {
          setDraft(value);
          setEditing(false);
        }}
      >
        <X aria-hidden className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" onClick={save} disabled={saving}>
        <Check aria-hidden className="mr-1 h-3.5 w-3.5" /> Guardar
      </Button>
    </div>
  );

  return (
    <Panel title="Sobre la empresa" icon={Building2} actions={actions}>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="¿A qué se dedica esta empresa? Sector, propuesta de valor, productos/servicios, público objetivo…"
          rows={5}
          autoFocus
        />
      ) : value ? (
        <p className="whitespace-pre-line text-sm text-foreground/90">{value}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          Aún no has descrito a qué se dedica esta empresa. Haz clic en Editar para añadirlo.
        </p>
      )}
    </Panel>
  );
}
