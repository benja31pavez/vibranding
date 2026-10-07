import { useState } from "react";
import { Globe, Link2, Megaphone, MessageCircle, UserPlus } from "lucide-react";
import {
  EmptyState,
  FitPage,
  FitPager,
  PageHeader,
  Panel,
  StatusBadge,
  type StatusTone,
} from "@/components/app";
import {
  LEADS_PAGE_SIZE,
  type ClientLead,
  type LeadSource,
  type LeadStatus,
  type Page,
} from "@/lib/client-panel/channelsModel";
import { formatInstant } from "./format";
import { PanelSectionState } from "./PanelSectionState";
import { usePanelLeads } from "./useChannelData";

const SOURCE_META: Record<LeadSource, { label: string; icon: typeof Globe }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  landing: { label: "Sitio web", icon: Globe },
  meta_ads: { label: "Meta Ads", icon: Megaphone },
  multilink: { label: "Multilink", icon: Link2 },
};

const STATUS_META: Record<LeadStatus, { label: string; tone: StatusTone }> = {
  new: { label: "Nuevo", tone: "info" },
  contacted: { label: "Contactado", tone: "warning" },
  won: { label: "Ganado", tone: "success" },
  lost: { label: "Perdido", tone: "neutral" },
};

/** Leads del negocio del cliente (solo lectura). Paginado en el servidor. */
export function LeadsPage() {
  const [page, setPage] = useState(0);
  const query = usePanelLeads(page);
  return (
    <FitPage
      header={<PageHeader size="compact" title="Leads" />}
      contentClassName="md:flex md:flex-col"
    >
      <PanelSectionState query={query} title="No pudimos cargar tus leads">
        {(leads) => (
          <LeadsList leads={leads} page={page} onPage={setPage} busy={query.isFetching} />
        )}
      </PanelSectionState>
    </FitPage>
  );
}

function LeadsList({
  leads,
  page,
  onPage,
  busy,
}: {
  leads: Page<ClientLead>;
  page: number;
  onPage: (page: number) => void;
  busy: boolean;
}) {
  const { total } = leads;
  if (total === 0) return <EmptyState icon={UserPlus} title="Aún no llegan leads" />;
  return (
    <Panel
      fill
      title={`${total} ${total === 1 ? "lead" : "leads"}`}
      actions={
        <FitPager
          page={page}
          pageCount={Math.ceil(total / LEADS_PAGE_SIZE)}
          onPageChange={onPage}
          label="Leads"
        />
      }
      bodyClassName="md:min-h-0 md:flex-1 md:overflow-y-auto"
    >
      <ul className="divide-y divide-border-subtle" aria-busy={busy}>
        {leads.items.map((lead) => (
          <LeadRow key={lead.key} lead={lead} />
        ))}
      </ul>
    </Panel>
  );
}

function LeadRow({ lead }: { lead: ClientLead }) {
  const source = SOURCE_META[lead.source];
  const status = STATUS_META[lead.status];
  const Icon = source.icon;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2.5 md:grid-cols-[auto_minmax(0,14rem)_minmax(0,1fr)_7.5rem_6.5rem]">
      <span
        title={source.label}
        className="grid h-8 w-8 place-items-center rounded-app-md bg-brand-soft text-brand-1"
      >
        <Icon aria-hidden className="h-4 w-4" />
        <span className="sr-only">{source.label}</span>
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{lead.name}</p>
        {lead.contact && (
          <p className="truncate text-xs text-muted-foreground tabular-nums">{lead.contact}</p>
        )}
      </div>
      <p
        className="col-span-3 col-start-2 row-start-2 truncate text-sm text-muted-foreground md:col-span-1 md:col-start-auto md:row-start-auto"
        title={lead.message ?? undefined}
      >
        {lead.message ?? ""}
      </p>
      <p className="hidden text-xs text-muted-foreground tabular-nums md:block">
        {lead.createdAt ? formatInstant(lead.createdAt) : ""}
      </p>
      <StatusBadge
        status={`lead_${lead.status}`}
        label={status.label}
        tone={status.tone}
        className="justify-self-end"
      />
    </li>
  );
}
