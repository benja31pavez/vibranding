import { useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clapperboard,
  FileSignature,
  ImageIcon,
  ListChecks,
  Wallet,
} from "lucide-react";
import { ErrorState, FitList, ListSkeleton } from "@/components/app";
import { usePortalCalendar } from "@/components/portal/usePortal";
import { Button } from "@/components/ui/button";
import { chileToday } from "@/lib/dates/chile";
import type {
  PortalApprovals,
  PortalBilling,
  PortalCalendar,
  SectionResult,
} from "@/lib/portal/model";
import { cn } from "@/lib/utils";
import { useLatestContract } from "../ContractPanel";
import { FichaCard } from "../FichaCard";
import { formatDate, type FichaOverview } from "../fichaQueries";
import { currentOnboardingLink } from "../OnboardingLinkPanel";
import {
  dayLabel,
  pendingWithClient,
  weekAgenda,
  weekMonths,
  type AgendaTarget,
  type PendingItem,
  type PendingKind,
  type WeekItem,
  type WeekKind,
} from "./clientAgenda";

type IconComponent = ComponentType<{ className?: string }>;
type Tab = "pending" | "week";

const MOBILE_PAGE_SIZE = 5;
const ACTION_CLS = "h-7 shrink-0 px-2 text-xs";

const PENDING_ICON: Readonly<Record<PendingKind, IconComponent>> = {
  deliverable: ClipboardCheck,
  post: ImageIcon,
  payment: Wallet,
  onboarding: ClipboardList,
  contract: FileSignature,
};

const WEEK_ICON: Readonly<Record<WeekKind, IconComponent>> = {
  post: ImageIcon,
  reel: Clapperboard,
  deliverable: ClipboardCheck,
  payment: Wallet,
};

function TabButton({
  active,
  label,
  count,
  controls,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  controls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "inline-flex min-w-0 flex-auto items-center justify-center gap-1.5 rounded-app-sm px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-surface text-foreground shadow-app-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      {count > 0 && <span className="rounded-full bg-surface-2 px-1.5 tabular-nums">{count}</span>}
    </button>
  );
}

function TargetButton({
  clientId,
  target,
  label,
}: {
  clientId: string;
  target: AgendaTarget;
  label: string;
}) {
  const children = (() => {
    switch (target.kind) {
      case "deliverables":
        return (
          <Link to="/clients/$clientId/deliverables" params={{ clientId }}>
            {label}
          </Link>
        );
      case "instagram":
        return (
          <Link to="/clients/$clientId/instagram" params={{ clientId }}>
            {label}
          </Link>
        );
      case "payments":
        return (
          <Link to="/clients/$clientId/facturacion" params={{ clientId }} search={{ tab: "pagos" }}>
            {label}
          </Link>
        );
      case "legal":
        return (
          <Link to="/clients/$clientId/legal" params={{ clientId }}>
            {label}
          </Link>
        );
      case "external":
        return (
          <a href={target.href} target="_blank" rel="noopener noreferrer">
            {label}
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        );
    }
  })();
  return (
    <Button asChild size="sm" variant="ghost" className={ACTION_CLS}>
      {children}
    </Button>
  );
}

function Row({
  icon: Icon,
  title,
  meta,
  metaTone,
  action,
}: {
  icon: IconComponent;
  title: string;
  meta: ReactNode;
  metaTone?: "danger";
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-1.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-app-md bg-surface-2">
        <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium" title={title}>
          {title}
        </p>
        {meta && (
          <p
            className={cn(
              "truncate text-xs",
              metaTone === "danger" ? "text-danger-strong" : "text-muted-foreground",
            )}
          >
            {meta}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function pendingMeta(item: PendingItem): string {
  if (!item.date) return "";
  if (item.kind === "payment") {
    return `${item.overdue ? "Venció" : "Vence"} el ${formatDate(item.date)}`;
  }
  if (item.kind === "post") return `Se publica el ${formatDate(item.date)}`;
  return `Para el ${formatDate(item.date)}`;
}

function OneLine({ children, icon: Icon }: { children: string; icon?: IconComponent }) {
  return (
    <p className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground">
      {Icon && <Icon aria-hidden className="h-4 w-4 text-success" />}
      {children}
    </p>
  );
}

interface ClientAgendaPanelProps {
  clientId: string;
  overview: FichaOverview | undefined;
  approvals: SectionResult<PortalApprovals> | undefined;
  billing: SectionResult<PortalBilling> | undefined;
  loading: boolean;
  onRetry: () => void;
}

/**
 * "Pendientes contigo" (lo que el cliente tiene que hacer para que avancemos) y
 * "Esta semana" (próximos 7 días). Solo destinos del entorno del cliente.
 */
export function ClientAgendaPanel({
  clientId,
  overview,
  approvals,
  billing,
  loading,
  onRetry,
}: ClientAgendaPanelProps) {
  const today = chileToday();
  const months = weekMonths(today);
  const mode = { kind: "preview", clientId } as const;
  const calA = usePortalCalendar(mode, months[0], true);
  const calB = usePortalCalendar(mode, months[1] ?? months[0], months.length > 1);
  const contract = useLatestContract(clientId);
  const [tab, setTab] = useState<Tab | null>(null);

  const link = overview ? currentOnboardingLink(overview) : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pending = pendingWithClient({
    approvals: approvals?.ok ? approvals.data : null,
    billing: billing?.ok ? billing.data : null,
    onboardingPending: overview?.status === "onboarding",
    onboardingUrl: link && origin ? `${origin}/onboarding/${link.token}` : null,
    contractToSign:
      contract.data?.status === "sent" ? { title: contract.data.title ?? "el contrato" } : null,
  });
  const calendars = [calA.data, months.length > 1 ? calB.data : null].filter(
    (c): c is PortalCalendar => Boolean(c),
  );
  const week = weekAgenda(calendars, billing?.ok ? billing.data : null, today);
  // Sin elección: abre en lo pendiente si hay algo; si no, en la semana.
  const active: Tab = tab ?? (pending.length === 0 && week.length > 0 ? "week" : "pending");

  const sectionError = approvals?.ok === false || billing?.ok === false;
  const weekLoading = calA.isLoading || (months.length > 1 && calB.isLoading);
  const weekError = calA.error ?? (months.length > 1 ? calB.error : null);

  return (
    <FichaCard title="Próximos pasos" icon={ListChecks} fill>
      <div className="flex min-w-0 flex-col gap-2.5 md:min-h-0 md:flex-1">
        <div
          role="tablist"
          aria-label="Pendientes y semana"
          className="flex shrink-0 gap-1 rounded-app-md bg-surface-2 p-1"
        >
          <TabButton
            active={active === "pending"}
            label="Pendientes contigo"
            count={pending.length}
            controls="resumen-pendientes"
            onClick={() => setTab("pending")}
          />
          <TabButton
            active={active === "week"}
            label="Esta semana"
            count={week.length}
            controls="resumen-semana"
            onClick={() => setTab("week")}
          />
        </div>
        <div
          id={active === "pending" ? "resumen-pendientes" : "resumen-semana"}
          role="tabpanel"
          className="flex min-w-0 flex-col md:min-h-0 md:flex-1"
        >
          {active === "pending" ? (
            loading || contract.isLoading ? (
              <ListSkeleton rows={3} label="Cargando pendientes" />
            ) : sectionError ? (
              <ErrorState message="No pudimos cargar los pendientes." onRetry={onRetry} />
            ) : pending.length === 0 ? (
              <OneLine icon={CheckCircle2}>Todo al día</OneLine>
            ) : (
              <FitList
                items={pending}
                getKey={(i) => i.id}
                label="Pendientes contigo"
                defaultPageSize={MOBILE_PAGE_SIZE}
                renderItem={(i) => (
                  <Row
                    icon={PENDING_ICON[i.kind]}
                    title={i.title}
                    meta={pendingMeta(i)}
                    metaTone={i.overdue ? "danger" : undefined}
                    action={
                      i.target && (
                        <TargetButton clientId={clientId} target={i.target} label={i.action} />
                      )
                    }
                  />
                )}
              />
            )
          ) : weekLoading ? (
            <ListSkeleton rows={3} label="Cargando la semana" />
          ) : weekError ? (
            <ErrorState
              message={weekError.message}
              onRetry={() => {
                void calA.refetch();
                if (months.length > 1) void calB.refetch();
              }}
            />
          ) : week.length === 0 ? (
            <OneLine>Nada agendado para estos 7 días</OneLine>
          ) : (
            <FitList
              items={week}
              getKey={(i) => i.id}
              label="Esta semana"
              defaultPageSize={MOBILE_PAGE_SIZE}
              renderItem={(i: WeekItem) => (
                <Row
                  icon={WEEK_ICON[i.kind]}
                  title={i.title}
                  meta={
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays aria-hidden className="h-3 w-3" />
                      {dayLabel(i.ymd, today)}
                    </span>
                  }
                />
              )}
            />
          )}
        </div>
      </div>
    </FichaCard>
  );
}
