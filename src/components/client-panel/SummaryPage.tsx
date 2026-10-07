import { ArrowRight, BarChart3, CheckCircle2, CreditCard, Flag, Hourglass } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  CompactStats,
  ErrorState,
  FitPage,
  ListSkeleton,
  PageHeader,
  Panel,
  type CompactStat,
} from "@/components/app";
import { usePortalSnapshot, type PortalMode } from "@/components/portal/usePortal";
import { periodLabel } from "@/lib/billing/dates";
import {
  DELIVERABLE_TYPE_LABEL,
  POST_FORMAT_LABEL,
  formatShortDate,
  pendingCount,
  type PortalApprovals,
  type PortalBilling,
  type PortalReport,
  type SectionResult,
} from "@/lib/portal/model";
import { useActiveClientSelf } from "./useClientSelf";

/** El cliente sale de la sesión (getPortalSnapshot usa user_client_id()), no de la URL. */
const CLIENT_MODE: PortalMode = { kind: "client" };
const PENDING_SHOWN = 5;
const CAPTION_CHARS = 70;

interface PendingRow {
  id: string;
  title: string;
  kind: string;
  date: string | null;
}

function pendingRows(approvals: PortalApprovals): PendingRow[] {
  const deliverables = approvals.deliverables.map((d) => ({
    id: `d-${d.id}`,
    title: d.title,
    kind: DELIVERABLE_TYPE_LABEL[d.type] ?? "Entrega",
    date: d.dueDate,
  }));
  const posts = approvals.posts.map((p) => {
    const caption = p.caption?.trim() ?? "";
    return {
      id: `p-${p.id}`,
      title:
        caption.length > CAPTION_CHARS
          ? `${caption.slice(0, CAPTION_CHARS)}…`
          : caption || POST_FORMAT_LABEL[p.format],
      kind: POST_FORMAT_LABEL[p.format],
      date: p.scheduledAt ? p.scheduledAt.slice(0, 10) : null,
    };
  });
  return [...deliverables, ...posts];
}

function billingStat(
  billing: SectionResult<PortalBilling> | undefined,
  loading: boolean,
): CompactStat {
  const stat: CompactStat = { key: "pagos", label: "Pagos", icon: CreditCard, value: "", loading };
  if (!billing?.ok) return { ...stat, value: loading ? "" : "Sin datos" };
  const open = billing.data.open;
  if (open.length === 0) return { ...stat, value: "Al día" };
  const overdue = open.some((p) => p.status === "overdue");
  return {
    ...stat,
    value: `${open.length} por pagar`,
    tone: overdue ? "danger" : "default",
  };
}

function planStat(
  billing: SectionResult<PortalBilling> | undefined,
  loading: boolean,
): CompactStat | null {
  const plan = billing?.ok ? billing.data.plan : null;
  if (!loading && !plan) return null;
  return {
    key: "plan",
    label: "Tu plan",
    icon: Flag,
    loading,
    value: plan?.label ?? "",
    hint: plan?.nextChargeDate
      ? `Próximo cobro: ${formatShortDate(plan.nextChargeDate)}`
      : undefined,
  };
}

function SectionBody<T>({
  failed,
  loading,
  result,
  onRetry,
  children,
}: {
  /** Falló todo el resumen: el aviso ya está arriba, aquí no se repite. */
  failed: boolean;
  loading: boolean;
  result: SectionResult<T> | undefined;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (failed) return null;
  if (loading || !result) return <ListSkeleton rows={3} label="Cargando…" />;
  if (!result.ok) return <ErrorState message={result.error} onRetry={onRetry} />;
  return <>{children(result.data)}</>;
}

function OneLine({ icon: Icon, children }: { icon: typeof CheckCircle2; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-brand-1" /> {children}
    </p>
  );
}

function PendingList({ approvals }: { approvals: PortalApprovals }) {
  const rows = pendingRows(approvals);
  if (rows.length === 0) return <OneLine icon={CheckCircle2}>Nada esperando tu OK</OneLine>;
  const extra = rows.length - PENDING_SHOWN;
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border-subtle">
        {rows.slice(0, PENDING_SHOWN).map((row) => (
          <li key={row.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.kind}
              {row.date ? ` · ${formatShortDate(row.date)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {extra > 0 && <p className="text-xs text-muted-foreground">y {extra} más</p>}
    </div>
  );
}

function ReportSummary({ report }: { report: PortalReport | null }) {
  if (!report) return <OneLine icon={Hourglass}>Tu primer reporte viene en camino</OneLine>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Resumen de <span className="font-medium text-foreground">{periodLabel(report.period)}</span>
      </p>
      {report.figures.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {report.figures.map((f) => (
            <li
              key={f.label}
              className="rounded-app-lg border border-border-subtle bg-bg p-3 shadow-app-xs"
            >
              <p className="truncate text-xs text-muted-foreground">{f.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{f.value}</p>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline" size="sm">
        <a href={`/r/${encodeURIComponent(report.token)}`} target="_blank" rel="noreferrer">
          Ver reporte completo <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

/** Resumen del cliente: lo que espera su OK, sus pagos y su último reporte (datos del portal). */
export function SummaryPage() {
  const client = useActiveClientSelf();
  const snapshot = usePortalSnapshot(CLIENT_MODE);
  const failed = snapshot.isError || snapshot.data?.status === "no_client";
  const data = snapshot.data?.status === "ok" ? snapshot.data.snapshot : undefined;
  const loading = snapshot.isPending;
  const retry = () => void snapshot.refetch();
  const pending = pendingCount(data?.approvals);

  const stats = (
    [
      {
        key: "aprobar",
        label: "Por aprobar",
        icon: CheckCircle2,
        loading,
        value: failed ? "Sin datos" : String(pending),
      },
      billingStat(data?.billing, loading),
      planStat(data?.billing, loading),
    ] satisfies (CompactStat | null)[]
  ).filter((s): s is CompactStat => s !== null);

  return (
    <FitPage
      header={<PageHeader size="compact" title={`Hola, ${client.name}`} />}
      contentClassName="flex flex-col gap-4"
    >
      {failed && (
        <ErrorState
          title="No pudimos cargar tu resumen"
          message="Intenta de nuevo en un momento."
          onRetry={retry}
          retrying={snapshot.isFetching}
        />
      )}
      <CompactStats
        items={stats}
        label="Tu marca hoy"
        className="shrink-0 [grid-auto-columns:minmax(0,1fr)] max-md:grid-flow-row max-md:divide-x-0 max-md:divide-y"
      />
      <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-2">
        <Panel title="Por aprobar" icon={CheckCircle2} fill bodyClassName="md:overflow-y-auto">
          <SectionBody failed={failed} loading={loading} result={data?.approvals} onRetry={retry}>
            {(approvals) => <PendingList approvals={approvals} />}
          </SectionBody>
        </Panel>
        <Panel title="Tus resultados" icon={BarChart3} fill bodyClassName="md:overflow-y-auto">
          <SectionBody failed={failed} loading={loading} result={data?.report} onRetry={retry}>
            {(report) => <ReportSummary report={report} />}
          </SectionBody>
        </Panel>
      </div>
    </FitPage>
  );
}
