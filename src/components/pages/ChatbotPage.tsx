import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectWhatsAppCard } from "@/components/chatbot/ConnectWhatsAppCard";
import { ConversationsTab } from "@/components/chatbot/ConversationsTab";
import { BotRulesTab } from "@/components/chatbot/BotRulesTab";
import { AIBotTab } from "@/components/chatbot/AIBotTab";
import { MetricsTab } from "@/components/chatbot/MetricsTab";
import { BusinessProfileTab } from "@/components/chatbot/BusinessProfileTab";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/app";
import { useInvalidateClientCapabilities } from "@/hooks/use-client-capabilities";

export type WAAccount = {
  id: string;
  client_id: string;
  phone_number_id: string | null;
  waba_id: string | null;
  display_phone_number: string | null;
  /** true when a token is stored (the token itself is server-only) */
  has_access_token: boolean;
  connected: boolean;
  ai_enabled: boolean;
  ai_system_prompt: string;
  ai_model: string;
  ai_debounce_seconds: number;
  ai_max_history: number;
  ai_business_context: string | null;
  profile_photo_url: string | null;
  website_url: string | null;
  timezone: string | null;
  social_links: { label: string; url: string }[] | null;
  catalog: { name: string; price?: string; url?: string; image_url?: string }[] | null;
  business_name: string | null;
  business_hours: { day: number; enabled: boolean; open: string; close: string }[] | null;
};

export function ChatbotPage({ clientId }: { clientId: string }) {
  const [acc, setAcc] = useState<WAAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const invalidateCaps = useInvalidateClientCapabilities();

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    // Reads go through the safe view: access_token / verify_token are server-only.
    const { data, error } = await (supabase.from("whatsapp_accounts_safe" as any) as any)
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) {
      setLoadError(error.message);
    } else {
      setAcc((data ?? null) as WAAccount | null);
      // El candado de WhatsApp del sidebar depende de esta conexión.
      void invalidateCaps(clientId);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [clientId]);

  if (loadError)
    return (
      <ErrorState
        title="No pudimos cargar la conexión de WhatsApp"
        message={loadError}
        onRetry={() => void load()}
        retrying={loading}
      />
    );
  if (loading && !acc) return <ListSkeleton rows={3} label="Cargando WhatsApp" />;

  return (
    <div className="space-y-4">
      <PageHeader size="compact" title="WhatsApp" />

      <ConnectWhatsAppCard clientId={clientId} account={acc} onChange={load} />

      {acc?.connected && (
        <Tabs defaultValue="conversations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="conversations">Conversaciones</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="ai">IA</TabsTrigger>
            <TabsTrigger value="rules">Reglas</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
          </TabsList>
          <TabsContent value="conversations">
            <ConversationsTab clientId={clientId} />
          </TabsContent>
          <TabsContent value="profile">
            <BusinessProfileTab account={acc} onChange={load} />
          </TabsContent>
          <TabsContent value="ai">
            <AIBotTab clientId={clientId} account={acc} onChange={load} />
          </TabsContent>
          <TabsContent value="rules">
            <BotRulesTab clientId={clientId} />
          </TabsContent>
          <TabsContent value="metrics">
            <MetricsTab clientId={clientId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
