import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Globe,
  Link2,
  Megaphone,
  MessageCircle,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  CompactStats,
  EmptyState,
  ErrorState,
  FitPage,
  ListSkeleton,
  PageHeader,
  Panel,
  SectionTabs,
  type SectionTab,
} from "@/components/app";
import { Badge } from "@/components/ui/badge";
import { LeadsPage } from "@/components/pages/LeadsPage";
import { chileToday } from "@/lib/dates/chile";
import { cn } from "@/lib/utils";
import {
  LEAD_ORIGINS,
  LEAD_ORIGIN_LABEL,
  LEAD_STATUSES,
  LEAD_STATUS_COLOR,
  LEAD_STATUS_LABEL,
  chileMonth,
  countByOrigin,
  countByStatus,
  leadKey,
  leadOrigin,
  useClientLeads,
  useUpsertLeadMeta,
  type Lead,
  type LeadOriginKey,
  type LeadStatus,
} from "./leadsData";

export type LeadsTab = "resumen" | "listado" | "embudo" | "origenes";
export const LEADS_TABS: readonly LeadsTab[] = ["resumen", "listado", "embudo", "origenes"];
export function isLeadsTab(v: unknown): v is LeadsTab {
  return typeof v === "string" && (LEADS_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<LeadsTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "listado", label: "Listado" },
  { key: "embudo", label: "Embudo" },
  { key: "origenes", label: "Orígenes" },
];

const DESCRIPTION: Readonly<Record<LeadsTab, string>> = {
  resumen: "Cuántos leads llegaron este mes, en qué estado están y de dónde vienen",
  listado: "Todos los leads del cliente, con filtros, etiquetas y notas",
  embudo: "Los leads por estado: de nuevo a ganado o perdido",
  origenes: "Por qué canal llega cada lead",
};

const MONTH_LABEL = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  year: "numeric",
  timeZone: "America/Santiago",
});

const ORIGIN_ICON: Readonly<Record<LeadOriginKey, typeof Globe>> = {
  whatsapp: MessageCircle,
  instagram: MessageCircle,
  landing: Globe,
  meta_ads: Megaphone,
  multilink: Link2,
};

interface LeadsSectionPageProps {
  clientId: string;
  tab: LeadsTab;
  onTabChange: (tab: LeadsTab) => void;
}

/**
 * Pantalla "Leads" del cliente con cuatro subsecciones: Resumen (indicadores
 * del mes), Listado (la tabla con filtros), Embudo (columnas por estado) y
 * Orígenes (conteo por canal).
 */
export function LeadsSectionPage({ clientId, tab, onTabChange }: LeadsSectionPageProps) {
  const query = useClientLeads(clientId);
  const leads = useMemo(() => query.data ?? [], [query.data]);
  const newCount = useMemo(() => leads.filter((l) => l.status === "new").length, [leads]);

  const tabs: readonly SectionTab<LeadsTab>[] = TABS.map((t) =>
    t.key === "embudo" ? { ...t, badge: newCount } : t,
  );

  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Leads" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={tabs} value={tab} onChange={onTabChange} label="Vistas de Leads" />
    </div>
  );

  if (tab === "listado") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <LeadsPage clientId={clientId} variant="embedded" />
      </FitPage>
    );
  }

  const state = {
    loading: query.isPending,
    error: query.error?.message ?? null,
    retry: () => void query.refetch(),
    retrying: query.isFetching,
  };

  if (tab === "embudo") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <FunnelView clientId={clientId} leads={leads} {...state} />
      </FitPage>
    );
  }

  if (tab === "origenes") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <OriginsView clientId={clientId} leads={leads} {...state} />
      </FitPage>
    );
  }

  return (
    <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
      <SummaryView clientId={clientId} leads={leads} {...state} />
    </FitPage>
  );
}

interface ViewProps {
  clientId: string;
  leads: readonly Lead[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  retrying: boolean;
}

function LoadGate({
  loading,
  error,
  retry,
  retrying,
  children,
}: Pick<ViewProps, "loading" | "error" | "retry" | "retrying"> & { children: React.ReactNode }) {
  if (error) {
    return (
      <ErrorState
        title="No pudimos cargar los leads"
        message={error}
        onRetry={retry}
        retrying={retrying}
      />
    );
  }
  if (loading) return <ListSkeleton rows={5} label="Cargando leads" />;
  return <>{children}</>;
}

// ------------------------------------------------------------------ Resumen

function SummaryView({ clientId, leads, ...state }: ViewProps) {
  const today = chileToday();
  const month = today.slice(0, 7);
  const monthLeads = useMemo(
    () => leads.filter((l) => chileMonth(l.created_at) === month),
    [leads, month],
  );
  const counts = useMemo(() => countByStatus(leads), [leads]);
  const origins = useMemo(() => countByOrigin(monthLeads), [monthLeads]);
  const topOrigin = (Object.keys(origins) as LeadOriginKey[])
    .filter((k) => origins[k] > 0)
    .sort((a, b) => origins[b] - origins[a])[0];
  const won = counts.won;
  const closed = counts.won + counts.lost;
  const monthLabel = MONTH_LABEL.format(new Date(`${today}T12:00:00`));

  return (
    <>
      <CompactStats
        label="Resumen de leads"
        className="grid-flow-row grid-cols-2 md:grid-flow-col md:auto-cols-fr"
        items={[
          {
            key: "mes",
            label: `Leads de ${monthLabel}`,
            icon: CalendarDays,
            loading: state.loading,
            value: monthLeads.length,
          },
          {
            key: "nuevos",
            label: "Nuevos sin contactar",
            icon: UserPlus,
            loading: state.loading,
            tone: counts.new > 0 ? "danger" : "default",
            value: counts.new,
            hint: "De todos los leads",
          },
          {
            key: "ganados",
            label: "Ganados",
            icon: Trophy,
            loading: state.loading,
            value: won,
            hint: closed > 0 ? `${Math.round((won / closed) * 100)} % de los cerrados` : undefined,
          },
          {
            key: "origen",
            label: "Origen principal del mes",
            icon: Sparkles,
            loading: state.loading,
            value: topOrigin ? LEAD_ORIGIN_LABEL[topOrigin] : "—",
            hint: topOrigin
              ? `${origins[topOrigin]} ${origins[topOrigin] === 1 ? "lead" : "leads"}`
              : undefined,
          },
        ]}
      />
      <LoadGate {...state}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Panel
            title="Por estado"
            icon={Users}
            description="Todos los leads del cliente, según su estado actual."
          >
            {leads.length === 0 ? (
              <EmptyState
                size="compact"
                title="Aún no hay leads"
                description="Cuando lleguen desde WhatsApp, la landing, Meta Ads o el multienlace aparecerán aquí."
                action={<TabLink clientId={clientId} tab="listado" label="Agregar uno a mano" />}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {LEAD_STATUSES.map((s) => (
                  <li key={s} className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={cn("w-24 justify-center text-xs", LEAD_STATUS_COLOR[s])}
                    >
                      {LEAD_STATUS_LABEL[s]}
                    </Badge>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gradient-brand"
                        style={{ width: `${(counts[s] / leads.length) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums">
                      {counts[s]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="min-w-0 md:col-span-2">
            <Panel
              title="Últimos leads"
              icon={UserPlus}
              description="Los cinco más recientes; el detalle completo está en Listado."
              actions={<TabLink clientId={clientId} tab="listado" label="Ver listado" />}
            >
              {leads.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Sin leads todavía.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {leads.slice(0, 5).map((l) => (
                    <li key={leadKey(l)} className="flex items-center gap-3 py-2">
                      <OriginIcon origin={leadOrigin(l)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {LEAD_ORIGIN_LABEL[leadOrigin(l)]}
                          {l.contact ? ` · ${l.contact}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 text-xs", LEAD_STATUS_COLOR[l.status])}
                      >
                        {LEAD_STATUS_LABEL[l.status]}
                      </Badge>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {formatLeadDate(l.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          El tiempo de respuesta aún no se registra: la plataforma guarda cuándo llega el lead, pero
          no cuándo se le contesta. Marca el estado «Contactado» al responder para seguir el embudo.
        </p>
      </LoadGate>
    </>
  );
}

// ------------------------------------------------------------------- Embudo

function FunnelView({ clientId, leads, ...state }: ViewProps) {
  const saveMeta = useUpsertLeadMeta(clientId);
  const byStatus = useMemo(() => {
    const groups: Record<LeadStatus, Lead[]> = { new: [], contacted: [], won: [], lost: [] };
    for (const l of leads) groups[l.status].push(l);
    return groups;
  }, [leads]);

  const move = async (lead: Lead, status: LeadStatus) => {
    if (status === lead.status) return;
    const error = await saveMeta(lead, { status });
    if (error) toast.error(`No se pudo mover el lead: ${error}`);
  };

  return (
    <LoadGate {...state}>
      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay leads en el embudo"
          description="Cada lead entra como «Nuevo»; desde aquí lo mueves a Contactado, Ganado o Perdido."
          action={<TabLink clientId={clientId} tab="listado" label="Agregar un lead" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {LEAD_STATUSES.map((s) => (
            <section
              key={s}
              aria-label={`${LEAD_STATUS_LABEL[s]}: ${byStatus[s].length}`}
              className="flex min-w-0 flex-col rounded-app-lg border border-border-subtle bg-surface shadow-app-xs"
            >
              <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
                <Badge variant="outline" className={cn("text-xs", LEAD_STATUS_COLOR[s])}>
                  {LEAD_STATUS_LABEL[s]}
                </Badge>
                <span className="text-sm font-semibold tabular-nums">{byStatus[s].length}</span>
              </header>
              {byStatus[s].length === 0 ? (
                <p className="px-4 pb-4 text-xs text-muted-foreground">Sin leads en este estado.</p>
              ) : (
                <ul className="flex flex-col gap-2 px-3 pb-3">
                  {byStatus[s].map((l) => (
                    <li
                      key={leadKey(l)}
                      className="rounded-app-md border border-border-subtle bg-bg p-3"
                    >
                      <div className="flex items-start gap-2">
                        <OriginIcon origin={leadOrigin(l)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" title={l.name}>
                            {l.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {LEAD_ORIGIN_LABEL[leadOrigin(l)]} · {formatLeadDate(l.created_at)}
                          </p>
                        </div>
                      </div>
                      {l.message && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {l.message}
                        </p>
                      )}
                      <label className="mt-2 block text-xs text-muted-foreground">
                        <span className="sr-only">Mover {l.name} a</span>
                        <select
                          value={l.status}
                          onChange={(e) => void move(l, e.target.value as LeadStatus)}
                          className="h-7 w-full rounded-app-sm border border-border-subtle bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {LEAD_STATUSES.map((o) => (
                            <option key={o} value={o}>
                              {o === l.status
                                ? LEAD_STATUS_LABEL[o]
                                : `Mover a ${LEAD_STATUS_LABEL[o]}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </LoadGate>
  );
}

// ----------------------------------------------------------------- Orígenes

/** Canales que la plataforma aún no conecta como fuente de leads. */
const MISSING_ORIGINS: ReadonlyArray<{ label: string; note: string }> = [
  {
    label: "Google Ads",
    note: "La integración de Google Ads trae métricas de campañas, no formularios de leads.",
  },
];

function OriginsView({ clientId, leads, ...state }: ViewProps) {
  const counts = useMemo(() => countByOrigin(leads), [leads]);
  const total = leads.length;
  const today = chileToday();
  const month = today.slice(0, 7);
  const monthCounts = useMemo(
    () => countByOrigin(leads.filter((l) => chileMonth(l.created_at) === month)),
    [leads, month],
  );

  return (
    <LoadGate {...state}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="min-w-0 md:col-span-2">
          <Panel
            title="Leads por canal"
            icon={Megaphone}
            description="Según el origen con que se registró cada lead. WhatsApp e Instagram se separan por el canal de la conversación."
          >
            {total === 0 ? (
              <EmptyState
                size="compact"
                title="Aún no hay leads que contar"
                description="Cuando lleguen, verás aquí cuántos vienen de cada canal."
                action={<TabLink clientId={clientId} tab="listado" label="Agregar un lead" />}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {LEAD_ORIGINS.map((k) => {
                  const n = counts[k];
                  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                  return (
                    <li key={k} className="flex items-center gap-3">
                      <OriginIcon origin={k} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {LEAD_ORIGIN_LABEL[k]}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {monthCounts[k]} este mes · {pct} %
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-gradient-brand"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-10 shrink-0 text-right text-base font-semibold tabular-nums">
                        {n}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
        <Panel
          title="Canales sin datos"
          icon={Globe}
          description="Lo que todavía no entra como lead a la plataforma."
        >
          <ul className="flex flex-col gap-3">
            {MISSING_ORIGINS.map((m) => (
              <li key={m.label}>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.note}</p>
              </li>
            ))}
            <li>
              <p className="text-sm font-medium">Leads manuales</p>
              <p className="text-xs text-muted-foreground">
                Los que agregas con «Nuevo lead» se cuentan en el canal que eliges al crearlos; no
                hay un origen «manual» separado.
              </p>
            </li>
          </ul>
        </Panel>
      </div>
    </LoadGate>
  );
}

// ------------------------------------------------------------------ piezas

function OriginIcon({ origin }: { origin: LeadOriginKey }) {
  const Icon = ORIGIN_ICON[origin];
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function TabLink({ clientId, tab, label }: { clientId: string; tab: LeadsTab; label: string }) {
  return (
    <Link
      to="/clients/$clientId/leads"
      params={{ clientId }}
      search={{ tab }}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowRight aria-hidden className="h-3 w-3" />
    </Link>
  );
}

function formatLeadDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
