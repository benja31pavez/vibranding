import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  Images,
  Instagram,
  MessageCircle,
  MessagesSquare,
  Plug,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  Panel,
  SectionTabs,
  StatCard,
  StatusBadge,
  type SectionTab,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { AudiencePanel } from "@/components/analytics/AudiencePanel";
import { ConversationsTab } from "@/components/chatbot/ConversationsTab";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { InstagramPage } from "@/components/pages/InstagramPage";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { EngagementCard, EngagementChip } from "./EngagementCard";
import { PostFeedbackPanel } from "./PostFeedbackPanel";

export type InstagramTab = "resumen" | "publicaciones" | "audiencia" | "mensajes";
export const INSTAGRAM_TABS: readonly InstagramTab[] = [
  "resumen",
  "publicaciones",
  "audiencia",
  "mensajes",
];
export function isInstagramTab(v: unknown): v is InstagramTab {
  return typeof v === "string" && (INSTAGRAM_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<InstagramTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "publicaciones", label: "Publicaciones" },
  { key: "audiencia", label: "Audiencia" },
  { key: "mensajes", label: "Mensajes" },
];

const DESCRIPTION: Readonly<Record<InstagramTab, string>> = {
  resumen: "Seguidores, publicaciones del mes y estado de la conexión",
  publicaciones: "Grilla actual, propuesta y versiones del plan de contenido",
  audiencia: "Seguidores, engagement y demografía del perfil",
  mensajes: "Comentarios automatizados y mensajes directos del perfil",
};

const nf = new Intl.NumberFormat("es-CL");

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sameMonth(iso: string | null, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

interface InstagramSectionPageProps {
  clientId: string;
  tab: InstagramTab;
  onTabChange: (tab: InstagramTab) => void;
}

/**
 * Sección Instagram del cliente con cuatro subsecciones: Resumen (seguidores, publicaciones
 * del mes frente al plan, próximas programadas y conexión), Publicaciones (editor y grilla),
 * Audiencia (engagement y demografía) y Mensajes (comentarios automatizados y DM).
 */
export function InstagramSectionPage({ clientId, tab, onTabChange }: InstagramSectionPageProps) {
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader
        size="compact"
        title="Instagram"
        description={DESCRIPTION[tab]}
        actions={<EngagementChip clientId={clientId} />}
      />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de Instagram" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {tab === "resumen" && <InstagramResumen clientId={clientId} onTabChange={onTabChange} />}
      {tab === "publicaciones" && (
        <>
          <PostFeedbackPanel clientId={clientId} />
          <InstagramPage clientId={clientId} />
        </>
      )}
      {tab === "audiencia" && <InstagramAudiencia clientId={clientId} />}
      {tab === "mensajes" && <InstagramMensajes clientId={clientId} />}
    </div>
  );
}

/* ----------------------------- Resumen ----------------------------- */

function InstagramResumen({
  clientId,
  onTabChange,
}: {
  clientId: string;
  onTabChange: (tab: InstagramTab) => void;
}) {
  const { ig, igError, reloadIG } = useActiveClient();
  const { caps, loading: capsLoading, error: capsError, reload } = useClientCapabilities(clientId);
  const now = new Date();
  const nowMs = now.getTime();

  const livePosts = ig.posts.filter(
    (p) => !(p as { archived_at?: string | null }).archived_at && !p.version_id,
  );
  const publishedThisMonth = livePosts.filter((p) => sameMonth(p.published_at, now)).length;
  const plannedThisMonth = livePosts.filter(
    (p) => p.type === "proposed" && sameMonth(p.scheduled_at, now),
  ).length;
  const upcoming = livePosts
    .filter((p) => p.scheduled_at && !p.published_at && new Date(p.scheduled_at).getTime() >= nowMs)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  const followers = ig.profile?.current_followers ?? null;
  const handle = ig.profile?.current_username ?? null;
  const syncedAt = ig.profile?.current_synced_at ?? null;
  const monthLabel = now.toLocaleDateString("es-CL", { month: "long" });

  if (igError) {
    return (
      <ErrorState
        title="No pudimos cargar los datos de Instagram"
        message={igError}
        onRetry={() => void reloadIG()}
      />
    );
  }

  return (
    <>
      <PostFeedbackPanel clientId={clientId} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-3">
        <StatCard
          label="Seguidores"
          icon={Users}
          value={followers !== null ? nf.format(followers) : "—"}
          hint={
            handle ? `@${handle}` : followers === null ? "Sin datos del perfil todavía" : undefined
          }
        />
        <StatCard
          label={`Publicadas en ${monthLabel}`}
          icon={Images}
          value={nf.format(publishedThisMonth)}
          hint={
            plannedThisMonth > 0
              ? `de ${nf.format(plannedThisMonth)} planificadas este mes`
              : "Sin publicaciones planificadas este mes"
          }
        />
        <StatCard
          label="Próximas programadas"
          icon={CalendarClock}
          value={nf.format(upcoming.length)}
          hint={upcoming[0] ? `La más cercana: ${fmtWhen(upcoming[0].scheduled_at!)}` : undefined}
        />
        <StatCard
          label="Conexión"
          icon={Plug}
          loading={capsLoading}
          value={
            capsError ? (
              <StatusBadge status="failed" label="Sin revisar" tone="warning" />
            ) : caps.has_instagram ? (
              <StatusBadge status="active" label="Vinculada" tone="success" />
            ) : (
              <StatusBadge status="pending" label="Sin vincular" tone="neutral" />
            )
          }
          hint={
            capsError ? (
              <button
                type="button"
                className="font-medium text-[color:var(--brand-1)] hover:underline"
                onClick={() => void reload()}
              >
                Reintentar
              </button>
            ) : syncedAt ? (
              `Sincronizado ${fmtWhen(syncedAt)}`
            ) : caps.has_instagram ? (
              "Aún no se sincroniza el perfil"
            ) : (
              <Link
                to="/clients/$clientId/anuncios"
                params={{ clientId }}
                search={{ tab: "meta" }}
                className="font-medium text-[color:var(--brand-1)] hover:underline"
              >
                Vincular en Anuncios › Meta Ads
              </Link>
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3">
        <Panel
          title="Próximas publicaciones"
          icon={CalendarClock}
          description="Piezas programadas que aún no se publican"
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/clients/$clientId/calendario" params={{ clientId }}>
                Ver calendario
              </Link>
            </Button>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState
              size="compact"
              icon={CalendarClock}
              title={`Nada programado para ${monthLabel}`}
              description="Las piezas con fecha en la propuesta aparecen aquí."
              action={
                <Button size="sm" onClick={() => onTabChange("publicaciones")}>
                  Ir a Publicaciones
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {upcoming.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-app-md object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-app-md bg-brand-soft" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{fmtWhen(p.scheduled_at!)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.caption?.trim() || "Sin texto todavía"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Accesos" icon={Instagram} description="Lo que puedes hacer en esta sección">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AccessItem
              icon={Images}
              title="Publicaciones"
              text="Grilla actual, propuesta y versiones."
              onClick={() => onTabChange("publicaciones")}
            />
            <AccessItem
              icon={Users}
              title="Audiencia"
              text="Engagement y demografía de seguidores."
              onClick={() => onTabChange("audiencia")}
            />
            <AccessItem
              icon={MessagesSquare}
              title="Mensajes"
              text="Comentarios automatizados y DM."
              onClick={() => onTabChange("mensajes")}
            />
            <li>
              <Link
                to="/clients/$clientId/automatizacion"
                params={{ clientId }}
                className="flex h-full flex-col gap-1 rounded-app-md border border-border-subtle bg-surface-2 p-3 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <MessageCircle aria-hidden className="h-4 w-4 text-brand-1" /> Automatización
                </span>
                <span className="text-xs text-muted-foreground">
                  Comentarios a DM, palabras clave y bienvenida.
                </span>
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}

function AccessItem({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex h-full w-full flex-col gap-1 rounded-app-md border border-border-subtle bg-surface-2 p-3 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon aria-hidden className="h-4 w-4 text-brand-1" /> {title}
        </span>
        <span className="text-xs text-muted-foreground">{text}</span>
      </button>
    </li>
  );
}

/* ----------------------------- Audiencia ----------------------------- */

function InstagramAudiencia({ clientId }: { clientId: string }) {
  const { ig } = useActiveClient();
  const profile = ig.profile;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-3">
        <StatCard
          label="Seguidores"
          icon={Users}
          value={profile?.current_followers != null ? nf.format(profile.current_followers) : "—"}
          hint={profile?.current_username ? `@${profile.current_username}` : undefined}
        />
        <StatCard
          label="Seguidos"
          icon={Users}
          value={profile?.current_following != null ? nf.format(profile.current_following) : "—"}
        />
        <StatCard
          label="Publicaciones en el perfil"
          icon={Images}
          value={
            profile?.current_posts_count != null ? nf.format(profile.current_posts_count) : "—"
          }
          hint={
            profile?.current_synced_at
              ? `Sincronizado ${fmtWhen(profile.current_synced_at)}`
              : "Sin sincronización del perfil todavía"
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-3">
        <EngagementCard clientId={clientId} />
        <AudiencePanel clientId={clientId} />
      </div>
    </>
  );
}

/* ----------------------------- Mensajes ----------------------------- */

type AutomationEvent = {
  id: string;
  created_at: string;
  commenter_username: string | null;
  comment_text: string | null;
  matched: boolean;
  reply_status: string;
  dm_status: string;
};

const EVENT_STATUS: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  sent: { label: "Enviado", tone: "success" },
  skipped: { label: "Omitido", tone: "neutral" },
  failed: { label: "Falló", tone: "danger" },
  window_closed: { label: "Ventana cerrada", tone: "warning" },
};

function eventBadge(status: string) {
  const def = EVENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <StatusBadge status={status} label={def.label} tone={def.tone} />;
}

function InstagramMensajes({ clientId }: { clientId: string }) {
  const userKey = useUserKey();
  const events = useQuery({
    queryKey: ["ig-automation-events", userKey, clientId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ig_automation_events")
        .select("id,created_at,commenter_username,comment_text,matched,reply_status,dm_status")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []) as AutomationEvent[];
    },
  });

  return (
    <>
      <Panel
        title="Mensajes directos"
        icon={MessagesSquare}
        description="Conversaciones de Instagram recibidas por la Bandeja (misma bandeja que WhatsApp)"
      >
        <ConversationsTab clientId={clientId} initialChannel="instagram" />
      </Panel>

      <Panel
        title="Comentarios automatizados"
        icon={MessageCircle}
        description="Últimos comentarios que recibió el webhook y qué respondió la automatización"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/clients/$clientId/automatizacion" params={{ clientId }}>
              Configurar automatización
            </Link>
          </Button>
        }
      >
        {events.isLoading ? (
          <ListSkeleton rows={4} label="Cargando comentarios" />
        ) : events.error ? (
          <ErrorState
            message={(events.error as Error).message}
            onRetry={() => void events.refetch()}
            retrying={events.isFetching}
          />
        ) : (events.data ?? []).length === 0 ? (
          <EmptyState
            size="compact"
            icon={MessageCircle}
            title="Aún no llegan comentarios por el webhook"
            description="Cuando la cuenta de Instagram esté vinculada en Meta y haya reglas de «Comentarios a DM» activas, aquí verás cada comentario recibido y si se respondió."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {(events.data ?? []).map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-start sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {e.commenter_username ? `@${e.commenter_username}` : "Usuario sin nombre"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {fmtWhen(e.created_at)}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.comment_text?.trim() || "Sin texto"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Respuesta:</span>
                  {eventBadge(e.reply_status)}
                  <span className="text-muted-foreground">DM:</span>
                  {eventBadge(e.dm_status)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
