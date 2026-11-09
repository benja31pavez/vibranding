import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Images,
  Inbox,
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
  PageHeader,
  Panel,
  SectionTabs,
  StatCard,
  StatusBadge,
  type SectionTab,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { ConversationsTab } from "@/components/chatbot/ConversationsTab";
import {
  InstagramSectionPage,
  isInstagramTab,
  type InstagramTab,
} from "@/components/instagram/InstagramSectionPage";
import {
  isWhatsAppTab,
  WhatsAppSectionPage,
  type WhatsAppTab,
} from "@/components/chatbot/WhatsAppSectionPage";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";

export type CanalesTab = "resumen" | "instagram" | "whatsapp" | "mensajes";

export const CANALES_TABS: readonly CanalesTab[] = ["resumen", "instagram", "whatsapp", "mensajes"];

export function isCanalesTab(v: unknown): v is CanalesTab {
  return typeof v === "string" && (CANALES_TABS as readonly string[]).includes(v);
}

const DESCRIPTION: Readonly<Record<CanalesTab, string>> = {
  resumen: "Estado de Instagram y WhatsApp del cliente en una sola pantalla",
  instagram: "Resumen, publicaciones, audiencia y mensajes de Instagram",
  whatsapp: "Chatbot, bandeja y métricas del número de WhatsApp",
  mensajes: "Conversaciones de WhatsApp e Instagram en un solo lugar",
};

const TABS: readonly SectionTab<CanalesTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "instagram", label: "Instagram" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "mensajes", label: "Mensajes" },
];

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

interface CanalesPageProps {
  clientId: string;
  tab: CanalesTab;
  onTabChange: (tab: CanalesTab) => void;
  /** Subpestaña dentro de Instagram (resumen, publicaciones, audiencia, mensajes). */
  igSub: InstagramTab;
  onIgSubChange: (sub: InstagramTab) => void;
  /** Subpestaña dentro de WhatsApp (resumen, chatbot, bandeja, plantillas). */
  waSub: WhatsAppTab;
  onWaSubChange: (sub: WhatsAppTab) => void;
}

/**
 * Sección "Canales" del cliente: Instagram, WhatsApp y bandeja unificada en una sola
 * pantalla con cuatro subsecciones. Las subpestañas internas de Instagram y WhatsApp
 * se guardan como search params aparte (`igsub` y `wasub`) para no chocar con el `tab`
 * de la pantalla.
 */
export function CanalesPage({
  clientId,
  tab,
  onTabChange,
  igSub,
  onIgSubChange,
  waSub,
  onWaSubChange,
}: CanalesPageProps) {
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Canales" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de Canales" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {tab === "resumen" && <CanalesResumen clientId={clientId} onTabChange={onTabChange} />}
      {tab === "instagram" && (
        <InstagramSectionPage clientId={clientId} tab={igSub} onTabChange={onIgSubChange} />
      )}
      {tab === "whatsapp" && (
        <WhatsAppSectionPage clientId={clientId} tab={waSub} onTabChange={onWaSubChange} />
      )}
      {tab === "mensajes" && <CanalesMensajes clientId={clientId} onTabChange={onTabChange} />}
    </div>
  );
}

/* ----------------------------- Resumen ----------------------------- */

export { isInstagramTab, isWhatsAppTab };

type ConversationCounts = { open: number; unread: number };

function useWaCounts(clientId: string, enabled: boolean) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["canales-wa-counts", userKey, clientId] as const,
    enabled,
    queryFn: async (): Promise<ConversationCounts> => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("status,unread_count")
        .eq("client_id", clientId);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return {
        open: rows.filter((r) => r.status === "open").length,
        unread: rows.reduce((acc, r) => acc + (r.unread_count ?? 0), 0),
      };
    },
  });
}

function sameMonth(iso: string | null, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function CanalesResumen({
  clientId,
  onTabChange,
}: {
  clientId: string;
  onTabChange: (tab: CanalesTab) => void;
}) {
  const { ig, igError, reloadIG } = useActiveClient();
  const { caps, loading: capsLoading, error: capsError, reload } = useClientCapabilities(clientId);
  const now = new Date();
  const nowMs = now.getTime();

  const livePosts = ig.posts.filter(
    (p) => !(p as { archived_at?: string | null }).archived_at && !p.version_id,
  );
  const publishedThisMonth = livePosts.filter((p) => sameMonth(p.published_at, now)).length;
  const upcoming = livePosts
    .filter((p) => p.scheduled_at && !p.published_at && new Date(p.scheduled_at).getTime() >= nowMs)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

  const followers = ig.profile?.current_followers ?? null;
  const handle = ig.profile?.current_username ?? null;

  const waCounts = useWaCounts(clientId, caps.has_whatsapp);

  const monthLabel = now.toLocaleDateString("es-CL", { month: "long" });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-3">
        <StatCard
          label="Seguidores de Instagram"
          icon={Users}
          value={followers !== null ? nf.format(followers) : "—"}
          hint={
            handle ? `@${handle}` : followers === null ? "Sin datos del perfil todavía" : undefined
          }
        />
        <StatCard
          label="Próximas publicaciones"
          icon={CalendarClock}
          value={nf.format(upcoming.length)}
          hint={
            upcoming[0]
              ? `La más cercana: ${fmtWhen(upcoming[0].scheduled_at!)}`
              : `Nada programado para ${monthLabel}`
          }
        />
        <StatCard
          label="Conversaciones WhatsApp"
          icon={Inbox}
          loading={caps.has_whatsapp && waCounts.isLoading}
          value={caps.has_whatsapp && waCounts.data ? nf.format(waCounts.data.open) : "—"}
          hint={
            caps.has_whatsapp && waCounts.data
              ? `${nf.format(waCounts.data.unread)} mensajes sin leer`
              : "Disponible al conectar WhatsApp"
          }
        />
        <StatCard
          label="Publicadas este mes"
          icon={Images}
          value={nf.format(publishedThisMonth)}
          hint={`Durante ${monthLabel}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-3">
        <StatCard
          label="Instagram"
          icon={Instagram}
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
            ) : caps.has_instagram ? (
              <button
                type="button"
                className="font-medium text-[color:var(--brand-1)] hover:underline"
                onClick={() => onTabChange("instagram")}
              >
                Abrir Instagram
              </button>
            ) : (
              <Link
                to="/clients/$clientId/anuncios"
                params={{ clientId }}
                search={{ tab: "configuracion" }}
                className="font-medium text-[color:var(--brand-1)] hover:underline"
              >
                Vincular en Anuncios › Configuración
              </Link>
            )
          }
        />
        <StatCard
          label="WhatsApp"
          icon={MessageCircle}
          loading={capsLoading}
          value={
            capsError ? (
              <StatusBadge status="failed" label="Sin revisar" tone="warning" />
            ) : caps.has_whatsapp ? (
              <StatusBadge status="active" label="Conectado" tone="success" />
            ) : (
              <StatusBadge status="pending" label="Sin conectar" tone="neutral" />
            )
          }
          hint={
            capsError ? undefined : caps.has_whatsapp ? (
              <button
                type="button"
                className="font-medium text-[color:var(--brand-1)] hover:underline"
                onClick={() => onTabChange("whatsapp")}
              >
                Abrir WhatsApp
              </button>
            ) : (
              <button
                type="button"
                className="font-medium text-[color:var(--brand-1)] hover:underline"
                onClick={() => onTabChange("whatsapp")}
              >
                Conectar WhatsApp
              </button>
            )
          }
        />
      </div>

      {igError && (
        <ErrorState
          title="No pudimos cargar los datos de Instagram"
          message={igError}
          onRetry={() => void reloadIG()}
        />
      )}

      <Panel title="Accesos" icon={Plug} description="Lo que puedes hacer en Canales">
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <AccessItem
            icon={Instagram}
            title="Instagram"
            text="Grilla, audiencia y mensajes directos."
            onClick={() => onTabChange("instagram")}
          />
          <AccessItem
            icon={MessageCircle}
            title="WhatsApp"
            text="Chatbot, bandeja y plantillas aprobadas."
            onClick={() => onTabChange("whatsapp")}
          />
          <AccessItem
            icon={MessagesSquare}
            title="Mensajes"
            text="DM de Instagram y WhatsApp en un solo lugar."
            onClick={() => onTabChange("mensajes")}
          />
        </ul>
      </Panel>
    </>
  );
}

/* ----------------------------- Mensajes unificados ----------------------------- */

function CanalesMensajes({
  clientId,
  onTabChange,
}: {
  clientId: string;
  onTabChange: (tab: CanalesTab) => void;
}) {
  const { caps, loading, error } = useClientCapabilities(clientId);
  if (loading) {
    return null;
  }
  if (!error && !caps.has_instagram && !caps.has_whatsapp) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="Aún no hay canales conectados"
        description="La vista unificada muestra los DM de Instagram y las conversaciones de WhatsApp en un solo lugar. Conecta alguno de los dos para ver mensajes aquí."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => onTabChange("instagram")}>
              Ir a Instagram
            </Button>
            <Button variant="outline" onClick={() => onTabChange("whatsapp")}>
              Ir a WhatsApp
            </Button>
          </div>
        }
      />
    );
  }
  return (
    <Panel
      title="Bandeja unificada"
      icon={MessagesSquare}
      description="Todas las conversaciones de WhatsApp e Instagram del cliente, filtrables por canal"
    >
      <ConversationsTab clientId={clientId} initialChannel="all" />
    </Panel>
  );
}

function AccessItem({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: typeof Instagram;
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
