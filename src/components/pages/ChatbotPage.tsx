import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectWhatsAppCard } from "@/components/chatbot/ConnectWhatsAppCard";
import { ConversationsTab } from "@/components/chatbot/ConversationsTab";
import { BotRulesTab } from "@/components/chatbot/BotRulesTab";
import { AIBotTab } from "@/components/chatbot/AIBotTab";
import { MetricsTab } from "@/components/chatbot/MetricsTab";
import { BusinessProfileTab } from "@/components/chatbot/BusinessProfileTab";
import { MessageCircle } from "lucide-react";


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
  business_hours:
    | { day: number; enabled: boolean; open: string; close: string }[]
    | null;
};

export function ChatbotPage({ clientId }: { clientId: string }) {
  const [acc, setAcc] = useState<WAAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    // Reads go through the safe view: access_token / verify_token are server-only.
    const { data } = await (supabase.from("whatsapp_accounts_safe" as any) as any)
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    setAcc((data ?? null) as WAAccount | null);
    setLoading(false);
  };


  useEffect(() => {
    load();
  }, [clientId]);

  if (loading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Sigue las conversaciones de tu cliente y configura respuestas automáticas.
          </p>
        </div>
      </header>

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
