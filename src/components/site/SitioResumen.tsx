import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Copy,
  ExternalLink,
  Globe,
  Inbox,
  Link2,
  MessageCircle,
  Pencil,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import {
  CompactStats,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Panel,
  StatusBadge,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { withoutBots } from "@/lib/analytics/bots";
import { multilinkPath } from "@/lib/multilink";
import { SITE_URL } from "@/lib/site";
import { displayUrl, landingPublicUrl } from "@/lib/site/siteStatus";
import { copyPublicLink } from "./copyLink";
import type { SiteSection, SitioPagina } from "./siteSections";

/** Período de las visitas del resumen (días, hoy incluido). */
const METRICS_DAYS = 30;
const EVENTS_LIMIT = 5000;

interface SitePageState {
  id: string;
  slug: string;
  published: boolean;
  updatedAt: string;
  url: string;
}

interface SitioSummary {
  landing: (SitePageState & { whatsappEnabled: boolean; contactEnabled: boolean }) | null;
  multilink: (SitePageState & { activeLinks: number; totalLinks: number }) | null;
  /** Mensajes recibidos por el formulario de contacto de la landing (total histórico). */
  contactMessages: number;
  /** Visitas (page_view, sin bots) de los últimos METRICS_DAYS días. */
  landingViews: number;
  multilinkViews: number;
}

async function fetchSummary(clientId: string): Promise<SitioSummary> {
  const since = new Date(Date.now() - (METRICS_DAYS - 1) * 86400000);
  since.setHours(0, 0, 0, 0);
  const [lpRes, mlRes, msgRes, evRes] = await Promise.all([
    supabase
      .from("landing_pages")
      .select("id,slug,published,updated_at,whatsapp_enabled,contact_enabled")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("multilinks")
      .select("id,slug,published,updated_at,custom_domain,custom_domain_verified")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("landing_contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("landing_events")
      .select("event_name,source_type,user_agent")
      .eq("client_id", clientId)
      .eq("event_name", "page_view")
      .gte("created_at", since.toISOString())
      .limit(EVENTS_LIMIT),
  ]);
  const error = lpRes.error ?? mlRes.error ?? msgRes.error ?? evRes.error;
  if (error) throw new Error(error.message);

  let multilink: SitioSummary["multilink"] = null;
  if (mlRes.data) {
    const itemsRes = await supabase
      .from("multilink_items")
      .select("is_active")
      .eq("multilink_id", mlRes.data.id);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const items = itemsRes.data ?? [];
    const ml = mlRes.data;
    const url =
      ml.custom_domain && ml.custom_domain_verified
        ? `https://${ml.custom_domain}${multilinkPath(ml.slug)}`
        : `${SITE_URL}${multilinkPath(ml.slug)}`;
    multilink = {
      id: ml.id,
      slug: ml.slug,
      published: ml.published,
      updatedAt: ml.updated_at,
      url,
      activeLinks: items.filter((i) => i.is_active).length,
      totalLinks: items.length,
    };
  }

  const views = withoutBots(
    (evRes.data ?? []) as { user_agent?: string | null; source_type: string }[],
  );
  return {
    landing: lpRes.data
      ? {
          id: lpRes.data.id,
          slug: lpRes.data.slug,
          published: lpRes.data.published,
          updatedAt: lpRes.data.updated_at,
          url: landingPublicUrl(lpRes.data.slug),
          whatsappEnabled: lpRes.data.whatsapp_enabled,
          contactEnabled: lpRes.data.contact_enabled,
        }
      : null,
    multilink,
    contactMessages: msgRes.count ?? 0,
    landingViews: views.filter((v) => v.source_type === "landing").length,
    multilinkViews: views.filter((v) => v.source_type === "multilink").length,
  };
}

export const sitioSummaryKey = (clientId: string) => ["sitio-summary", clientId] as const;

function useSitioSummary(clientId: string) {
  return useQuery({
    queryKey: sitioSummaryKey(clientId),
    queryFn: () => fetchSummary(clientId),
    // Al volver a Resumen tras publicar o editar, se vuelve a leer el estado.
    refetchOnMount: "always",
  });
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

interface PageCardProps {
  icon: LucideIcon;
  title: string;
  page: SitePageState | null;
  detail: string | null;
  loading: boolean;
  createHint: string;
  pagina: SitioPagina;
  onOpen: (section: SiteSection, pagina: SitioPagina) => void;
}

/** Tarjeta de una página del sitio: estado, URL pública y accesos a sus subsecciones. */
function PageCard({
  icon: Icon,
  title,
  page,
  detail,
  loading,
  createHint,
  pagina,
  onOpen,
}: PageCardProps) {
  return (
    <Panel
      title={title}
      icon={Icon}
      actions={
        page ? (
          <StatusBadge
            status={page.published ? "published" : "draft"}
            label={page.published ? "Publicada" : "Borrador"}
            tone={page.published ? "success" : "warning"}
          />
        ) : undefined
      }
    >
      {loading ? (
        <ListSkeleton rows={2} label={`Cargando ${title.toLowerCase()}`} />
      ) : !page ? (
        <EmptyState
          size="compact"
          icon={Icon}
          title={`Aún no hay ${title.toLowerCase()}`}
          description={createHint}
          action={
            <Button size="sm" onClick={() => onOpen("secciones", pagina)}>
              <Pencil aria-hidden className="mr-1.5 h-4 w-4" /> Crear
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="min-w-0 truncate rounded-app-sm bg-surface-2 px-2 py-1 text-xs">
              {displayUrl(page.url)}
            </code>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label={`Copiar link de ${title.toLowerCase()}`}
              title="Copiar link"
              onClick={() => void copyPublicLink(page.url, page.published)}
            >
              <Copy aria-hidden className="h-4 w-4" />
            </Button>
            {page.published && (
              <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Ver ${title.toLowerCase()} publicada`}
                  title="Ver publicada"
                >
                  <ExternalLink aria-hidden className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {[detail, `Última edición: ${formatUpdated(page.updatedAt)}`]
              .filter(Boolean)
              .join(" · ")}
            {!page.published && " · El link funciona cuando publiques."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onOpen("secciones", pagina)}>
              <Pencil aria-hidden className="mr-1.5 h-4 w-4" /> Editar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpen("dominio", pagina)}>
              <Settings2 aria-hidden className="mr-1.5 h-4 w-4" /> Dominio y conexiones
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpen("analitica", pagina)}>
              <Activity aria-hidden className="mr-1.5 h-4 w-4" /> Analítica
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

interface SitioResumenProps {
  clientId: string;
  onOpen: (section: SiteSection, pagina: SitioPagina) => void;
}

/**
 * Resumen del sitio del cliente: estado de publicación y URL de la landing y del
 * multienlace, visitas de los últimos 30 días, mensajes recibidos y accesos directos.
 */
export function SitioResumen({ clientId, onOpen }: SitioResumenProps) {
  const summary = useSitioSummary(clientId);
  const data = summary.data;
  const loading = summary.isLoading;

  if (summary.error) {
    return (
      <ErrorState
        title="No pudimos cargar el resumen del sitio"
        message={summary.error.message}
        onRetry={() => void summary.refetch()}
        retrying={summary.isFetching}
      />
    );
  }

  const landingDetail = data?.landing
    ? [
        data.landing.whatsappEnabled ? "WhatsApp activo" : "Sin WhatsApp",
        data.landing.contactEnabled ? "Formulario activo" : "Sin formulario",
      ].join(" · ")
    : null;
  const multilinkDetail = data?.multilink
    ? `${data.multilink.activeLinks} ${data.multilink.activeLinks === 1 ? "enlace visible" : "enlaces visibles"} de ${data.multilink.totalLinks}`
    : null;

  return (
    <div className="flex flex-col gap-4 md:gap-3">
      <CompactStats
        label={`Indicadores del sitio (últimos ${METRICS_DAYS} días)`}
        className="shrink-0 grid-flow-row grid-cols-2 divide-x-0 md:grid-flow-col md:auto-cols-fr md:divide-x"
        items={[
          {
            key: "landing-views",
            label: "Visitas a la landing",
            value: data?.landing ? data.landingViews : "—",
            hint: data?.landing
              ? `Últimos ${METRICS_DAYS} días, sin bots`
              : "Se miden al publicar la landing",
            icon: Globe,
            loading,
          },
          {
            key: "multilink-views",
            label: "Visitas al multienlace",
            value: data?.multilink ? data.multilinkViews : "—",
            hint: data?.multilink
              ? `Últimos ${METRICS_DAYS} días, sin bots`
              : "Se miden al publicar el multienlace",
            icon: Link2,
            loading,
          },
          {
            key: "messages",
            label: "Mensajes recibidos",
            value: data ? data.contactMessages : "—",
            hint: "Formulario de contacto de la landing",
            icon: Inbox,
            loading,
          },
          {
            key: "whatsapp",
            label: "WhatsApp",
            value: data?.landing ? (data.landing.whatsappEnabled ? "Activo" : "Inactivo") : "—",
            hint: "Botón de WhatsApp en la landing",
            icon: MessageCircle,
            loading,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3">
        <PageCard
          icon={Globe}
          title="Landing page"
          page={data?.landing ?? null}
          detail={landingDetail}
          loading={loading}
          createHint="Una página con portada, servicios, WhatsApp y formulario, lista para publicar en /@slug."
          pagina="landing"
          onOpen={onOpen}
        />
        <PageCard
          icon={Link2}
          title="Multienlace"
          page={data?.multilink ?? null}
          detail={multilinkDetail}
          loading={loading}
          createHint="Los enlaces de la bio de Instagram y TikTok, con QR para imprimir."
          pagina="multienlace"
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}
