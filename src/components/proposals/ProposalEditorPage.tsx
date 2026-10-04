import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, type BreadcrumbItem } from "@/components/app";
import { supabase } from "@/integrations/supabase/client";
import { ProposalEditor } from "./ProposalEditor";
import { useRecipient, type ProposalRow, type Recipient } from "./proposalQueries";

/** ¿Puede el usuario editar? La BD vuelve a validar en cada escritura (RLS). */
function useCanEdit(recipient: Recipient | null | undefined) {
  return useQuery({
    queryKey: ["proposals", "can-edit", recipient?.kind, recipient?.id],
    enabled: Boolean(recipient),
    queryFn: async () => {
      if (!recipient) return false;
      const { data, error } =
        recipient.kind === "client"
          ? await supabase.rpc("can_edit_client", { _client_id: recipient.id })
          : await supabase.rpc("can_edit_org", { _org_id: recipient.orgId });
      if (error) return false;
      return Boolean(data);
    },
  });
}

interface Props {
  target: { clientId?: string | null; prospectId?: string | null };
  existing?: ProposalRow;
}

/** Carga destinatario y permisos y muestra el editor (nueva o existente). */
export function ProposalEditorPage({ target, existing }: Props) {
  const recipient = useRecipient(target);
  const canEdit = useCanEdit(recipient.data);
  const hasTarget = Boolean(target.clientId || target.prospectId);

  const breadcrumb: BreadcrumbItem[] = [
    target.clientId
      ? { label: recipient.data?.name ?? "Cliente", to: `/clients/${target.clientId}` as BreadcrumbItem["to"] }
      : { label: recipient.data?.name ?? "Prospecto" },
    { label: existing ? "Propuesta" : "Nueva propuesta" },
  ];

  if (!hasTarget) {
    return (
      <EmptyState
        icon={FileText}
        title="Falta el destinatario"
        description="Crea la propuesta desde la ficha de un cliente o desde un prospecto."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={existing?.title || (existing ? "Propuesta" : "Nueva propuesta")}
        description="Plan, adicionales, vencimiento y link público para aceptar y pagar."
        breadcrumb={breadcrumb}
      />
      {recipient.isLoading || canEdit.isLoading ? (
        <ListSkeleton rows={6} label="Cargando propuesta" />
      ) : recipient.error ? (
        <ErrorState message={recipient.error.message} onRetry={() => void recipient.refetch()} />
      ) : !recipient.data ? (
        <EmptyState icon={FileText} title="No encontramos el destinatario" description="Puede que no tengas acceso." />
      ) : (
        <ProposalEditor
          key={existing ? `${existing.id}-${existing.status}-${existing.sent_at ?? ""}` : "new"}
          recipient={recipient.data}
          existing={existing}
          canEdit={Boolean(canEdit.data)}
        />
      )}
    </div>
  );
}
