import { Instagram } from "lucide-react";
import { FitPage } from "@/components/app";
import { usePortalSnapshot } from "@/components/portal/usePortal";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { ClientLogo } from "@/components/clients/logo";
import { chileToday } from "@/lib/dates/chile";
import { formatDate, useFichaOverview } from "../fichaQueries";
import { ClientAgendaPanel } from "./ClientAgendaPanel";
import { ClientDocsPanel } from "./ClientDocsPanel";
import { ClientStatusRow } from "./ClientStatusRow";
import { ClientTimelinePanel } from "./ClientTimelinePanel";
import { useCycleProgress } from "./clientFichaQueries";
import { monthSummary, type MonthPost } from "./clientView";
import { MonthSummaryCard } from "./MonthSummaryCard";
import { PlanCard } from "./PlanCard";
import { TeamCard } from "./TeamCard";

function ClientFichaHeader({ startedAt }: { startedAt: string | null }) {
  const { client, ig } = useActiveClient();
  if (!client) return null;
  const avatar = ig.profile?.current_avatar_url;
  return (
    <header className="flex min-w-0 items-center gap-3">
      <ClientLogo
        clientId={client.id}
        name={client.name}
        fallbackSrc={avatar}
        initials={client.name[0]?.toUpperCase()}
        className="h-11 w-11 rounded-app-md bg-surface-2 text-lg font-semibold"
      />
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{client.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {client.instagram_handle && (
            <a
              href={`https://instagram.com/${encodeURIComponent(client.instagram_handle)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Instagram aria-hidden className="h-3.5 w-3.5" /> @{client.instagram_handle}
            </a>
          )}
          {startedAt && <span>Juntos desde el {formatDate(startedAt)}</span>}
        </div>
      </div>
    </header>
  );
}

/**
 * Resumen del cliente (ítem "Resumen" del panel izquierdo): lo que el cliente
 * también puede ver, en una pantalla desde `md`. Misma estructura que la
 * gestión de la agencia, sin salud, MRR, notas ni mensajes internos.
 */
export function ClientFichaPage({ clientId }: { clientId: string }) {
  const { ig } = useActiveClient();
  const overview = useFichaOverview(clientId);
  const snapshot = usePortalSnapshot({ kind: "preview", clientId });
  const month = chileToday().slice(0, 7);
  const cycle = useCycleProgress(clientId, month);
  const posts = ig.posts as MonthPost[];
  const summary = monthSummary(posts, month);
  const data = snapshot.data?.status === "ok" ? snapshot.data.snapshot : undefined;
  // Si el portal no carga, cada sección muestra su error en vez de un "al día" engañoso.
  const failed =
    snapshot.error || snapshot.data?.status === "no_client"
      ? ({ ok: false, error: snapshot.error?.message ?? "No pudimos cargar el portal." } as const)
      : undefined;
  const approvals = data?.approvals ?? failed;
  const billing = data?.billing ?? failed;
  const report = data?.report ?? failed;
  const loading = snapshot.isLoading;
  const planKey = overview.data?.billing?.plan_key ?? null;

  return (
    <FitPage
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ClientFichaHeader startedAt={overview.data?.startedAt ?? null} />
          <TeamCard />
        </div>
      }
      contentClassName="flex flex-col gap-4 md:gap-3"
    >
      <div className="shrink-0">
        <ClientStatusRow
          clientId={clientId}
          planKey={planKey}
          loading={loading}
          approvals={approvals}
          billing={billing}
          cycle={cycle.data}
          cycleLoading={cycle.isLoading}
        />
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-3 md:gap-3">
        <div className="min-w-0 md:col-span-2">
          <MonthSummaryCard
            clientId={clientId}
            month={month}
            summary={summary}
            approvals={approvals}
            loading={loading}
          />
        </div>
        <PlanCard
          clientId={clientId}
          planKey={planKey}
          month={month}
          pieces={summary.pieces}
          cycle={cycle.data}
          billing={billing}
          report={report}
          loading={loading || overview.isLoading}
          onRetry={() => void snapshot.refetch()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] md:gap-3 xl:grid-cols-3">
        <ClientTimelinePanel clientId={clientId} />
        {/* Bajo xl, "Próximos pasos" y Documentos comparten la segunda columna. */}
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0 md:gap-3 xl:contents">
          <ClientAgendaPanel
            clientId={clientId}
            overview={overview.data}
            approvals={approvals}
            billing={billing}
            loading={loading || overview.isLoading}
            onRetry={() => void snapshot.refetch()}
          />
          <ClientDocsPanel clientId={clientId} billing={billing} />
        </div>
      </div>
    </FitPage>
  );
}
