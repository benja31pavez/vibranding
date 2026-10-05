import { Download, FileText, Trash2 } from "lucide-react";
import { EmptyState, Money, TONE_CLASSES, getStatus } from "@/components/app";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CONTRACT_STATUS_OPTIONS,
  contractSummaryLabel,
  type ClientContract,
  type ContractStatus,
} from "./contractModel";

export interface ContractHistoryProps {
  contracts: readonly ClientContract[];
  onSetStatus: (id: string, status: ContractStatus) => void;
  onDownload: (contract: ClientContract) => void;
  onDelete: (id: string) => void;
  className?: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Historial de contratos del cliente: estado, plan, fecha, monto y acciones. */
export function ContractHistory({
  contracts,
  onSetStatus,
  onDownload,
  onDelete,
  className,
}: ContractHistoryProps) {
  return (
    <section
      aria-labelledby="contract-history-title"
      className={`flex min-h-0 flex-col rounded-app-lg border border-border-subtle bg-surface shadow-app-xs ${className ?? ""}`}
    >
      <header className="flex items-baseline justify-between gap-2 px-5 pb-3 pt-4">
        <h2 id="contract-history-title" className="text-sm font-semibold text-foreground">
          Historial
        </h2>
        {contracts.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {contracts.length} {contracts.length === 1 ? "contrato" : "contratos"}
          </span>
        )}
      </header>

      {contracts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 pb-5">
          <EmptyState
            size="compact"
            icon={FileText}
            title="Aún no hay contratos"
            description="Cuando crees el primero aparecerá aquí con su estado y su PDF."
          />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border-subtle overflow-y-auto border-t border-border-subtle">
          {contracts.map((c) => (
            <ContractRow
              key={c.id}
              contract={c}
              onSetStatus={onSetStatus}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ContractRow({
  contract: c,
  onSetStatus,
  onDownload,
  onDelete,
}: {
  contract: ClientContract;
  onSetStatus: (id: string, status: ContractStatus) => void;
  onDownload: (contract: ClientContract) => void;
  onDelete: (id: string) => void;
}) {
  const oneTime = Number(c.total_one_time);
  const monthly = Number(c.total_monthly);
  const summary = contractSummaryLabel(c.services_snapshot);
  return (
    <li className="space-y-1.5 px-5 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-foreground" title={c.title}>
          {summary}
        </p>
        <StatusSelect
          status={c.status}
          label={`Estado de ${summary}`}
          onChange={(status) => onSetStatus(c.id, status)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {DATE_FORMAT.format(new Date(c.created_at))}
          {oneTime > 0 && (
            <>
              {" · "}
              <Money amount={oneTime} currency={c.currency} className="text-foreground" />
            </>
          )}
          {monthly > 0 && (
            <>
              {" · "}
              <Money amount={monthly} currency={c.currency} className="text-foreground" />
              /mes
            </>
          )}
        </p>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDownload(c)}
            aria-label="Descargar PDF"
            title="Descargar PDF"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(c.id)}
            aria-label="Eliminar contrato"
            title="Eliminar contrato"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Estado del contrato como pastilla de color que a la vez permite cambiarlo. */
function StatusSelect({
  status,
  label,
  onChange,
}: {
  status: ContractStatus;
  label: string;
  onChange: (status: ContractStatus) => void;
}) {
  const tone = TONE_CLASSES[getStatus(status).tone];
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as ContractStatus)}
      aria-label={label}
      title="Cambiar estado"
      className={cn(
        "h-6 shrink-0 cursor-pointer rounded-full border-0 pl-2 pr-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone.badge,
      )}
    >
      {CONTRACT_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
