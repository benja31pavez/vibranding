import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Globe, Link2, Megaphone, MessageCircle, UserPlus } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  FitPage,
  FitPager,
  ListSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  type StatusTone,
} from "@/components/app";
import {
  LEADS_PAGE_SIZE,
  fetchClientLeads,
  type ClientLead,
  type LeadSource,
  type LeadStatus,
} from "./clientData";
import { formatInstant } from "./format";
import { useActiveClientSelf } from "./useClientSelf";

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
  const self = useActiveClientSelf();
  const [page, setPage] = useState(0);
  const leads = useQuery({
    queryKey: ["client-panel", self.id, "leads", page],
    queryFn: () => fetchClientLeads(page),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const total = leads.data?.total ?? 0;
  const pageCount = Math.ceil(total / LEADS_PAGE_SIZE);

  return (
    <FitPage
      header={<PageHeader size="compact" title="Leads" />}
      contentClassName="md:flex md:flex-col"
    >
      {leads.isPending ? (
        <Panel>
          <ListSkeleton rows={6} label="Cargando leads…" />
        </Panel>
      ) : leads.isError ? (
        <ErrorState
          message={leads.error.message}
          onRetry={() => void leads.refetch()}
          retrying={leads.isFetching}
        />
      ) : total === 0 ? (
        <EmptyState icon={UserPlus} title="Aún no llegan leads" />
      ) : (
        <Panel
          fill
          title={`${total} ${total === 1 ? "lead" : "leads"}`}
          actions={
            <FitPager page={page} pageCount={pageCount} onPageChange={setPage} label="Leads" />
          }
          bodyClassName="md:min-h-0 md:flex-1 md:overflow-y-auto"
        >
          <ul className="divide-y divide-border-subtle" aria-busy={leads.isFetching}>
            {leads.data.items.map((lead) => (
              <LeadRow key={lead.key} lead={lead} />
            ))}
          </ul>
        </Panel>
      )}
    </FitPage>
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
