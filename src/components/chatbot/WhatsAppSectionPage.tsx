import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  FileText,
  Inbox,
  MessageCircle,
  Plug,
  Star,
  UserRound,
  type LucideIcon,
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
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import type { WAAccount } from "@/components/pages/ChatbotPage";
import { useInvalidateClientCapabilities } from "@/hooks/use-client-capabilities";
import { AIBotTab } from "./AIBotTab";
import { BotRulesTab } from "./BotRulesTab";
import { BusinessProfileTab } from "./BusinessProfileTab";
import { ConnectWhatsAppCard } from "./ConnectWhatsAppCard";
import { ConversationsTab } from "./ConversationsTab";
import { MetricsTab } from "./MetricsTab";

export type WhatsAppTab = "resumen" | "chatbot" | "bandeja" | "plantillas";
export const WHATSAPP_TABS: readonly WhatsAppTab[] = [
  "resumen",
  "chatbot",
  "bandeja",
  "plantillas",
];
export function isWhatsAppTab(v: unknown): v is WhatsAppTab {
  return typeof v === "string" && (WHATSAPP_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<WhatsAppTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "chatbot", label: "Chatbot" },
  {
    key: "bandeja",
    label: (
      <>
        <span className="sm:hidden">Bandeja</span>
        <span className="hidden sm:inline">Bandeja de mensajes</span>
      </>
    ),
  },
  { key: "plantillas", label: "Plantillas" },
];

const DESCRIPTION: Readonly<Record<WhatsAppTab, string>> = {
  resumen: "Estado del número, conversaciones y métricas de los últimos 30 días",
  chatbot: "Respuestas automáticas, asistente con IA y perfil del negocio",
  bandeja: "Conversaciones de WhatsApp e Instagram en un solo lugar",
  plantillas: "Plantillas de mensaje aprobadas por Meta",
};

const nf = new Intl.NumberFormat("es-CL");

/**
 * Cuenta de WhatsApp del cliente (vista segura: el token nunca llega al navegador).
 * Compartida por el resumen, el chatbot y la bandeja de la sección WhatsApp.
 */
export function useWhatsAppAccount(clientId: string) {
  const [account, setAccount] = useState<WAAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const invalidateCaps = useInvalidateClientCapabilities();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Reads go through the safe view: access_token / verify_token are server-only.
    const { data, error } = await (supabase.from("whatsapp_accounts_safe" as any) as any)
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else {
      setAccount((data ?? null) as WAAccount | null);
      // El candado de WhatsApp del sidebar depende de esta conexión.
      void invalidateCaps(clientId);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { account, loading, error, reload };
}

interface WhatsAppSectionPageProps {
  clientId: string;
  tab: WhatsAppTab;
  onTabChange: (tab: WhatsAppTab) => void;
}

/**
 * Sección WhatsApp del cliente con cuatro subsecciones: Resumen (conexión, conversaciones
 * abiertas, derivadas a humano, métricas), Chatbot (reglas, IA y perfil), Bandeja de
 * mensajes y Plantillas. Sin número conectado, cada subsección muestra el estado bloqueado.
 */
export function WhatsAppSectionPage({ clientId, tab, onTabChange }: WhatsAppSectionPageProps) {
  const { account, loading, error, reload } = useWhatsAppAccount(clientId);
  const connected = Boolean(account?.connected);

  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="WhatsApp" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de WhatsApp" />
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState
          title="No pudimos cargar la conexión de WhatsApp"
          message={error}
          onRetry={() => void reload()}
          retrying={loading}
        />
      </div>
    );
  }

  if (loading && !account) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ListSkeleton rows={3} label="Cargando WhatsApp" />
      </div>
    );
  }

  const locked = (what: string) => (
    <>
      <ConnectWhatsAppCard clientId={clientId} account={account} onChange={reload} />
      <EmptyState
        icon={Plug}
        title="WhatsApp no está conectado"
        description={`${what} se activa cuando el número del cliente quede conectado por la API oficial de Meta (Cloud API).`}
        action={
          <Button variant="outline" onClick={() => onTabChange("resumen")}>
            Volver al resumen
          </Button>
        }
      />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {tab === "resumen" && (
        <WhatsAppResumen
          clientId={clientId}
          account={account}
          onAccountChange={reload}
          onTabChange={onTabChange}
        />
      )}

      {tab === "chatbot" &&
        (connected && account ? (
          <Tabs defaultValue="rules" className="space-y-4">
            <TabsList aria-label="Partes del chatbot">
              <TabsTrigger value="rules">Reglas y flujos</TabsTrigger>
              <TabsTrigger value="ai">Asistente con IA</TabsTrigger>
              <TabsTrigger value="profile">Perfil del negocio</TabsTrigger>
            </TabsList>
            <TabsContent value="rules">
              <BotRulesTab clientId={clientId} />
            </TabsContent>
            <TabsContent value="ai">
              <AIBotTab clientId={clientId} account={account} onChange={reload} />
            </TabsContent>
            <TabsContent value="profile">
              <BusinessProfileTab account={account} onChange={reload} />
            </TabsContent>
          </Tabs>
        ) : (
          locked("El chatbot")
        ))}

      {tab === "bandeja" &&
        (connected ? <ConversationsTab clientId={clientId} /> : locked("La bandeja de mensajes"))}

      {tab === "plantillas" && <WhatsAppPlantillas connected={connected} />}
    </div>
  );
}

/* ----------------------------- Resumen ----------------------------- */

interface ConversationCounts {
  open: number;
  followup: number;
  leads: number;
  unread: number;
}

function useConversationCounts(clientId: string, enabled: boolean) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: ["whatsapp-conversation-counts", userKey, clientId] as const,
    enabled,
    queryFn: async (): Promise<ConversationCounts> => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("status,needs_human_followup,is_lead,unread_count")
        .eq("client_id", clientId);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return {
        open: rows.filter((r) => r.status === "open").length,
        followup: rows.filter((r) => r.needs_human_followup).length,
        leads: rows.filter((r) => r.is_lead).length,
        unread: rows.reduce((acc, r) => acc + (r.unread_count ?? 0), 0),
      };
    },
  });
}

function WhatsAppResumen({
  clientId,
  account,
  onAccountChange,
  onTabChange,
}: {
  clientId: string;
  account: WAAccount | null;
  onAccountChange: () => void | Promise<void>;
  onTabChange: (tab: WhatsAppTab) => void;
}) {
  const connected = Boolean(account?.connected);
  const counts = useConversationCounts(clientId, connected);
  const [rulesCount, setRulesCount] = useState<number | null>(null);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void supabase
      .from("whatsapp_bot_rules")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_active", true)
      .then(({ count }) => {
        if (!cancelled) setRulesCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, connected]);

  return (
    <>
      <ConnectWhatsAppCard clientId={clientId} account={account} onChange={onAccountChange} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-3">
        <StatCard
          label="Número"
          icon={Plug}
          value={
            connected ? (
              <StatusBadge status="active" label="Conectado" tone="success" />
            ) : (
              <StatusBadge status="pending" label="Sin conectar" tone="neutral" />
            )
          }
          hint={
            account?.display_phone_number
              ? account.display_phone_number
              : connected
                ? "Número sin nombre visible"
                : "Completa la conexión arriba"
          }
        />
        <StatCard
          label="Conversaciones abiertas"
          icon={Inbox}
          loading={connected && counts.isLoading}
          value={connected && counts.data ? nf.format(counts.data.open) : "—"}
          hint={
            connected && counts.data
              ? `${nf.format(counts.data.unread)} mensajes sin leer`
              : "Disponible al conectar"
          }
        />
        <StatCard
          label="Derivadas a humano"
          icon={UserRound}
          loading={connected && counts.isLoading}
          value={connected && counts.data ? nf.format(counts.data.followup) : "—"}
          hint={
            connected && counts.data
              ? `${nf.format(counts.data.leads)} marcadas como lead`
              : "Disponible al conectar"
          }
        />
        <StatCard
          label="Plantillas aprobadas"
          icon={FileText}
          value="—"
          hint="Aún no se sincronizan desde Meta"
        />
      </div>

      {counts.error && (
        <ErrorState
          title="No pudimos contar las conversaciones"
          message={(counts.error as Error).message}
          onRetry={() => void counts.refetch()}
          retrying={counts.isFetching}
        />
      )}

      <Panel title="Accesos" icon={MessageCircle} description="Lo que puedes hacer en esta sección">
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <AccessItem
            icon={Bot}
            title="Chatbot"
            text={
              rulesCount === null
                ? "Reglas, flujos, asistente con IA y perfil."
                : `${nf.format(rulesCount)} ${rulesCount === 1 ? "regla activa" : "reglas activas"}${account?.ai_enabled ? " · IA encendida" : " · IA apagada"}`
            }
            onClick={() => onTabChange("chatbot")}
          />
          <AccessItem
            icon={Inbox}
            title="Bandeja de mensajes"
            text="Responde, marca leads y cierra conversaciones."
            onClick={() => onTabChange("bandeja")}
          />
          <AccessItem
            icon={Star}
            title="Plantillas"
            text="Mensajes aprobados por Meta para iniciar conversaciones."
            onClick={() => onTabChange("plantillas")}
          />
        </ul>
      </Panel>

      {connected && <MetricsTab clientId={clientId} />}
    </>
  );
}

function AccessItem({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: LucideIcon;
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

/* ----------------------------- Plantillas ----------------------------- */

function WhatsAppPlantillas({ connected }: { connected: boolean }) {
  return (
    <EmptyState
      icon={FileText}
      title="Las plantillas todavía no se sincronizan"
      description={
        connected
          ? "Aquí verás las plantillas de mensaje de la cuenta de WhatsApp Business (nombre, categoría, idioma y estado de aprobación en Meta). Falta construir la ingesta desde la API de Meta; mientras tanto, revísalas en el administrador de WhatsApp de Meta."
          : "Aquí verás las plantillas de mensaje aprobadas por Meta. Primero conecta el número del cliente desde el resumen; después se podrá activar la sincronización de plantillas."
      }
      action={
        <Button asChild variant="outline">
          <a
            href="https://business.facebook.com/wa/manage/message-templates/"
            target="_blank"
            rel="noreferrer"
          >
            Abrir plantillas en Meta
          </a>
        </Button>
      }
    />
  );
}
