import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, PageContainer, PageHeader, type BreadcrumbItem } from "@/components/app";
import { ProposalEditor } from "./ProposalEditor";
import { useCanEditRecipient as useCanEdit, useRecipient, type ProposalRow } from "./proposalQueries";

/** Márgenes de página de las pantallas de propuestas (el layout _app no los pone). */
export function ProposalPageShell({ children }: { children: ReactNode }) {
  return <PageContainer className="max-w-5xl space-y-6">{children}</PageContainer>;
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
      : { label: recipient.data?.name ?? "Prospecto", to: "/pipeline" },
    { label: existing ? "Propuesta" : "Nueva propuesta" },
  ];

  if (!hasTarget) {
    return (
      <ProposalPageShell>
        <EmptyState
          icon={FileText}
          title="Falta el destinatario"
          description="Crea la propuesta desde la ficha de un cliente o desde un prospecto."
        />
      </ProposalPageShell>
    );
  }

  return (
    <ProposalPageShell>
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
    </ProposalPageShell>
  );
}
