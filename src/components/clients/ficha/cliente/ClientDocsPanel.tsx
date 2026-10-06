import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileBarChart, FileSignature, FolderOpen, Receipt } from "lucide-react";
import {
  ErrorState,
  FitList,
  ListSkeleton,
  Money,
  TONE_CLASSES,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useClientReports, type MonthlyReportRow } from "@/components/reports/reportQueries";
import { chileToday } from "@/lib/dates/chile";
import type { PortalBilling, SectionResult } from "@/lib/portal/model";
import { cn } from "@/lib/utils";
import { useLatestContract } from "../ContractPanel";
import { FichaCard } from "../FichaCard";
import { formatDate, useUserKey } from "../fichaQueries";
import { shortPeriod } from "./clientView";

const MOBILE_PAGE_SIZE = 6;
/** Reportes enviados que se listan (los más recientes). */
const REPORTS_SHOWN = 6;

const ACTION_CLS = "h-7 shrink-0 px-2 text-xs";

interface DocItem {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  status: ReactNode;
  tone: StatusTone;
  action: ReactNode;
}

function DocRow({ item }: { item: DocItem }) {
  const Icon = item.icon;
  return (
    <div className="flex min-w-0 items-center gap-3 py-1.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-app-md bg-surface-2">
        <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_CLASSES[item.tone].dot)}
          />
          <span className="truncate">{item.status}</span>
        </p>
      </div>
      {item.action}
    </div>
  );
}

const CONTRACT_STATUS: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  signed: { label: "Firmado", tone: "success" },
  sent: { label: "Por firmar", tone: "warning" },
  draft: { label: "En preparación", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

function reportItem(r: MonthlyReportRow): DocItem {
  return {
    id: `report-${r.id}`,
    icon: FileBarChart,
    title: `Reporte de ${shortPeriod(r.period, chileToday())}`,
    status: `Enviado el ${formatDate(r.sent_at)}`,
    tone: "info",
    action: (
      <Button asChild size="sm" variant="ghost" className={ACTION_CLS}>
        <a href={`/r/${encodeURIComponent(r.token)}`} target="_blank" rel="noopener noreferrer">
          Abrir
        </a>
      </Button>
    ),
  };
}

interface ClientDocsPanelProps {
  clientId: string;
  billing: SectionResult<PortalBilling> | undefined;
}

/** "Documentos": contrato, pagos y reportes enviados, cada uno con su acción. */
export function ClientDocsPanel({ clientId, billing }: ClientDocsPanelProps) {
  const userKey = useUserKey();
  const contract = useLatestContract(clientId);
  const reports = useClientReports(userKey, clientId);
  const sent = (reports.data ?? []).filter((r) => r.sent_at).slice(0, REPORTS_SHOWN);
  const contractMeta = contract.data ? CONTRACT_STATUS[contract.data.status] : undefined;
  const lastPaid = billing?.ok ? billing.data.recentPaid[0] : undefined;
  const open = billing?.ok ? billing.data.open.length : 0;

  const items: DocItem[] = [
    {
      id: "contract",
      icon: FileSignature,
      title: contract.data?.title?.trim() || "Contrato",
      status: contractMeta
        ? contract.data?.signed_at
          ? `${contractMeta.label} el ${formatDate(contract.data.signed_at)}`
          : contractMeta.label
        : "Sin contrato",
      tone: contractMeta?.tone ?? "neutral",
      action: (
        <Button asChild size="sm" variant="ghost" className={ACTION_CLS}>
          <Link to="/clients/$clientId/legal" params={{ clientId }}>
            Ver
          </Link>
        </Button>
      ),
    },
    {
      id: "payments",
      icon: Receipt,
      title: "Pagos y boletas",
      status:
        open > 0 ? (
          `${open} por pagar`
        ) : lastPaid ? (
          <>
            Último pago: <Money amount={lastPaid.amount} currency={lastPaid.currency} />
          </>
        ) : (
          "Sin pagos aún"
        ),
      tone: open > 0 ? "warning" : lastPaid ? "success" : "neutral",
      action: (
        <Button asChild size="sm" variant="ghost" className={ACTION_CLS}>
          <Link to="/clients/$clientId/facturacion" params={{ clientId }} search={{ tab: "pagos" }}>
            Ver
          </Link>
        </Button>
      ),
    },
    ...sent.map(reportItem),
  ];

  return (
    <FichaCard title="Documentos" icon={FolderOpen} fill>
      {contract.isLoading || reports.isLoading ? (
        <ListSkeleton rows={3} label="Cargando documentos" />
      ) : contract.error || reports.error ? (
        <ErrorState
          message={(contract.error ?? reports.error)?.message}
          onRetry={() => {
            void contract.refetch();
            void reports.refetch();
          }}
        />
      ) : (
        <>
          <FitList
            items={items}
            getKey={(i) => i.id}
            label="Documentos"
            defaultPageSize={MOBILE_PAGE_SIZE}
            renderItem={(i) => <DocRow item={i} />}
          />
          {sent.length === 0 && (
            <p className="pt-1 text-xs text-muted-foreground">Aún sin reportes enviados</p>
          )}
        </>
      )}
    </FichaCard>
  );
}
