import { useState, type ReactNode } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  ErrorState,
  FitList,
  ListSkeleton,
  Money,
  Panel,
  StatusBadge,
} from "@/components/app";
import { PaymentReminderDialog } from "@/components/billing/PaymentReminderDialog";
import { EditPaymentDialog } from "@/components/billing/statement/EditPaymentDialog";
import { FlowSetupNote } from "@/components/billing/statement/FlowSetupNote";
import { PrimaryAction, type FlowState } from "@/components/billing/statement/PaymentActions";
import { PaymentRowMenu, type RowMenuAction } from "@/components/billing/statement/PaymentRowMenu";
import { UploadDocumentDialog } from "@/components/billing/statement/UploadDocumentDialog";
import { fmtDay, fmtMonth } from "@/components/billing/statement/format";
import { deletePayment } from "@/components/billing/statement/paymentWrites";
import {
  displayStatus,
  relativeDue,
  type StatementAccess,
  type StatementPayment,
} from "@/components/billing/statement/statementData";
import { periodLabel } from "@/lib/billing/dates";
import { findPlan } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

export interface PaymentsPanelProps {
  clientId: string;
  clientName: string;
  payments: readonly StatementPayment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  access: StatementAccess;
  flow: FlowState;
  /** Variables faltantes de Flow (solo llegan a administradores de plataforma). */
  flowMissing: string[] | null;
  today: string;
  onChanged: () => void;
}

/**
 * Lista "Pagos" del estado de cuenta. Todo pago entra por la plataforma (Flow):
 * la agencia no crea cobros ni los marca pagados a mano. Sus acciones (recordar,
 * boleta, editar, eliminar) van en el menú ⋯.
 */
export function PaymentsPanel({
  clientId,
  clientName,
  payments,
  loading,
  error,
  onRetry,
  access,
  flow,
  flowMissing,
  today,
  onChanged,
}: PaymentsPanelProps) {
  const [editing, setEditing] = useState<StatementPayment | null>(null);
  const [uploading, setUploading] = useState<StatementPayment | null>(null);
  const [reminding, setReminding] = useState<StatementPayment | null>(null);
  const [toDelete, setToDelete] = useState<StatementPayment | null>(null);
  const agency = access.canEdit;

  const remove = async (p: StatementPayment) => {
    const err = await deletePayment(p.id);
    if (err) toast.error(err);
    else toast.success("Cobro eliminado");
    onChanged();
  };

  const onAction = (action: RowMenuAction, p: StatementPayment) => {
    if (action === "remind") setReminding(p);
    else if (action === "upload") setUploading(p);
    else if (action === "edit") setEditing(p);
    else setToDelete(p);
  };

  const renderRow = (p: StatementPayment, stacked: boolean) => (
    <PaymentRow
      payment={p}
      today={today}
      stacked={stacked}
      action={<PrimaryAction payment={p} flow={flow} canEdit={agency} onChanged={onChanged} />}
      menu={
        agency ? (
          <PaymentRowMenu payment={p} flow={flow} onAction={onAction} onChanged={onChanged} />
        ) : null
      }
    />
  );

  return (
    <Panel
      title="Pagos"
      icon={Receipt}
      fill
      bodyClassName="md:flex md:min-h-0 md:flex-1 md:flex-col"
      actions={agency && flow === "off" && <FlowSetupNote missing={flowMissing} />}
    >
      {loading ? (
        <ListSkeleton rows={4} label="Cargando pagos" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : payments.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Aún no hay cobros.</p>
      ) : (
        <FitList
          items={payments}
          getKey={(p) => p.id}
          label="Pagos"
          renderItem={(p, ctx) => renderRow(p, ctx.inSheet)}
        />
      )}

      {agency && (
        <>
          <EditPaymentDialog
            payment={editing}
            canChangeStatus={access.canManage}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              onChanged();
            }}
          />
          <UploadDocumentDialog
            payment={uploading}
            onClose={() => setUploading(null)}
            onUploaded={onChanged}
          />
          {reminding && (
            <PaymentReminderDialog
              open
              onOpenChange={(o) => {
                if (!o) setReminding(null);
              }}
              payment={reminding}
              clientId={clientId}
              clientName={clientName}
              today={today}
              onReminded={() => undefined}
            />
          )}
          <ConfirmDialog
            open={toDelete !== null}
            onOpenChange={(o) => {
              if (!o) setToDelete(null);
            }}
            title="¿Eliminar este cobro?"
            description={`Se borra «${toDelete?.description || "Cobro"}» de forma permanente. Si solo no se va a cobrar, es mejor cambiar su estado a Cancelado para conservar el historial.`}
            confirmLabel="Eliminar"
            destructive
            onConfirm={() => {
              if (toDelete) void remove(toDelete);
              setToDelete(null);
            }}
          />
        </>
      )}
    </Panel>
  );
}

/**
 * "Plan Contenido · 6 oct 2026 – 6 nov 2026" para pagos de plan con período;
 * si no, "Plan mensual · oct 2026" (sin repetir el mes si ya está en el concepto).
 */
function conceptLabel(p: StatementPayment): string {
  const plan = findPlan(p.plan_key);
  if (plan && p.period_start && p.period_end) {
    return `${plan.label} · ${fmtDay(p.period_start)} – ${fmtDay(p.period_end)}`;
  }
  const base = p.description?.trim() || "Cobro";
  if (!p.period) return base;
  const month = periodLabel(p.period).split(" ")[0];
  return base.toLowerCase().includes(month) ? base : `${base} · ${fmtMonth(p.period)}`;
}

function dueLine(p: StatementPayment, today: string): { text: string; late: boolean } | null {
  const relative = relativeDue(p, today);
  if (relative) return { text: relative, late: relative.startsWith("Venció") };
  if (p.status === "paid" && p.paid_at) {
    return { text: `Pagado el ${fmtDay(p.paid_at)}`, late: false };
  }
  if (p.due_date) return { text: `Vencimiento ${fmtDay(p.due_date)}`, late: false };
  return null;
}

function PaymentRow({
  payment: p,
  today,
  stacked,
  action,
  menu,
}: {
  payment: StatementPayment;
  today: string;
  stacked: boolean;
  action: ReactNode;
  menu: ReactNode;
}) {
  const due = dueLine(p, today);
  const label = conceptLabel(p);
  const cols = !stacked;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm",
        cols && "lg:flex-nowrap",
      )}
    >
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-medium" title={label}>
          {label}
        </p>
        {due && (
          <p
            className={cn(
              "truncate text-xs",
              due.late ? "font-medium text-danger-strong" : "text-muted-foreground",
            )}
          >
            {due.text}
            {p.due_date && relativeDue(p, today) && (
              <span className="font-normal text-muted-foreground"> · {fmtDay(p.due_date)}</span>
            )}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center gap-3",
          cols && "lg:w-28 lg:flex-col lg:items-end lg:gap-1",
        )}
      >
        <Money amount={p.amount} currency={p.currency} className="font-semibold" />
        <StatusBadge status={displayStatus(p, today)} />
      </div>
      <div className={cn("flex shrink-0 items-center gap-1", cols ? "w-full sm:w-40" : "w-full")}>
        <div className="min-w-0 flex-1">{action}</div>
        {menu}
      </div>
    </div>
  );
}
