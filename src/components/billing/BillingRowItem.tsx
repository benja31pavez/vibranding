import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BellRing, Check } from "lucide-react";
import { Money, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { periodLabel } from "@/lib/billing/dates";
import { daysUntilDue } from "@/lib/billing/reminders";
import { cn } from "@/lib/utils";
import { PaymentLinkButton } from "./PaymentLinkButton";
import { PaymentReminderDialog } from "./PaymentReminderDialog";
import { isOverdue, type BillingRow } from "./billingData";

const DATE_FMT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmtDate = (iso: string) => DATE_FMT.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** "Venció hace 3 días" / "Vence hoy" / "Vence en 5 días" (solo cobros abiertos). */
function relativeDue(row: BillingRow, today: string): string | null {
  if (row.status !== "pending" && row.status !== "overdue") return null;
  const diff = daysUntilDue(row.due_date, today);
  if (diff === null) return null;
  if (diff < 0) return `Venció hace ${days(-diff)}`;
  if (diff === 0) return "Vence hoy";
  return `Vence en ${days(diff)}`;
}

/** Anchos compartidos por el encabezado y las filas (desde lg). */
const COL = {
  due: "lg:w-36",
  amount: "lg:w-28",
  status: "lg:w-28",
} as const;

/**
 * Acciones en 2 columnas fijas (desde lg): "Recordar pago" y link de pago
 * (Generar / Copiar / cargando, de ancho variable) quedan alineados entre filas.
 * No hay "Marcar pagado": el pago lo confirma Flow. Los botones llenan su columna.
 */
const ACTIONS_W = "lg:block lg:w-[20.5rem]";
const ACTIONS_GRID = "lg:grid lg:w-[20.5rem] lg:grid-cols-[8.5rem_11.5rem] lg:flex-nowrap";
const ACTION_CELL = "lg:min-w-0 lg:[&_button]:w-full";

export interface BillingRowItemProps {
  row: BillingRow;
  today: string;
  remindedToday: boolean;
  /** Panel "Ver todos": filas apiladas, sin columnas. */
  stacked?: boolean;
  onReminded: () => void;
  onChanged: () => void;
}

export function BillingRowItem({
  row: r,
  today,
  remindedToday,
  stacked = false,
  onReminded,
  onChanged,
}: BillingRowItemProps) {
  const late = isOverdue(r, today);
  const open = r.status === "pending" || r.status === "overdue";
  const relative = relativeDue(r, today);
  const concept = [r.description || "Cobro", r.period ? periodLabel(r.period) : null]
    .filter(Boolean)
    .join(" · ");
  const cols = !stacked;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-sm",
        cols && "lg:flex-nowrap",
      )}
    >
      <div className={cn("min-w-0 flex-1 basis-48", cols && "lg:basis-auto")}>
        <Link
          to="/clients/$clientId/facturacion"
          params={{ clientId: r.client_id }}
          search={{ tab: "pagos" }}
          className="block truncate rounded-app-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {r.client_name}
        </Link>
        <span className="block truncate text-xs text-muted-foreground" title={concept}>
          {concept}
        </span>
      </div>

      <div className={cn("shrink-0 tabular-nums", cols && COL.due)}>
        <span className={cn("block", late ? "text-danger-strong" : "text-foreground")}>
          {r.due_date ? fmtDate(r.due_date) : "—"}
        </span>
        {relative && (
          <span
            className={cn(
              "block text-xs",
              late ? "font-medium text-danger-strong" : "text-muted-foreground",
            )}
          >
            {relative}
          </span>
        )}
      </div>

      <Money
        amount={r.amount}
        currency={r.currency}
        className={cn("shrink-0 font-semibold", cols && cn(COL.amount, "lg:text-right"))}
      />

      <div className={cn("flex shrink-0 flex-col items-start gap-0.5", cols && COL.status)}>
        <StatusBadge status={late ? "overdue" : r.status} />
        {open && remindedToday && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check aria-hidden className="h-3 w-3" />
            Recordado hoy
          </span>
        )}
      </div>

      {open ? (
        <div className={cn("flex shrink-0 flex-wrap gap-2", cols ? ACTIONS_GRID : "w-full")}>
          <div className={ACTION_CELL}>
            <RemindButton row={r} today={today} onReminded={onReminded} />
          </div>
          <div className={ACTION_CELL}>
            <PaymentLinkButton payment={r} onChanged={onChanged} />
          </div>
        </div>
      ) : (
        cols && <span aria-hidden className={cn("hidden shrink-0", ACTIONS_W)} />
      )}
    </div>
  );
}

/** Encabezado de columnas (solo escritorio), alineado con `BillingRowItem`. */
export function BillingRowHeader() {
  const th = "shrink-0 text-xs font-medium text-muted-foreground";
  return (
    <div aria-hidden className="hidden items-center gap-x-4 pb-1.5 lg:flex">
      <span className={cn(th, "min-w-0 flex-1")}>Cliente y concepto</span>
      <span className={cn(th, COL.due)}>Vencimiento</span>
      <span className={cn(th, COL.amount, "text-right")}>Monto</span>
      <span className={cn(th, COL.status)}>Estado</span>
      <span className={cn(th, ACTIONS_W)} />
    </div>
  );
}

function RemindButton({
  row,
  today,
  onReminded,
}: {
  row: BillingRow;
  today: string;
  onReminded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const remindedWhileOpen = useRef(false);
  // La marca se aplica al cerrar: la lista no se reordena con el diálogo abierto.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && remindedWhileOpen.current) {
      remindedWhileOpen.current = false;
      onReminded();
    }
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BellRing className="mr-1 h-3.5 w-3.5" aria-hidden />
        Recordar pago
      </Button>
      {open && (
        <PaymentReminderDialog
          open={open}
          onOpenChange={handleOpenChange}
          payment={row}
          clientId={row.client_id}
          clientName={row.client_name}
          today={today}
          onReminded={() => {
            remindedWhileOpen.current = true;
          }}
        />
      )}
    </>
  );
}
