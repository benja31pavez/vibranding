import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, BotOff, User, Star, X, Search, RefreshCw, Clock, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";

type Conv = {
  id: string;
  contact_wa_id: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  is_lead: boolean;
  status: string;
  ai_paused: boolean;
  pending_response_at: string | null;
  needs_human_followup: boolean;
  human_followup_reason: string | null;
  human_followup_at: string | null;
};

type Msg = {
  id: string;
  direction: "inbound" | "outbound";
  from_bot: boolean;
  body: string | null;
  type: string;
  timestamp: string;
  status: string | null;
};

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

export function ConversationsTab({ clientId }: { clientId: string }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [search, setSearch] = useState("");
  const [filterLead, setFilterLead] = useState(false);

  const loadConvs = async () => {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("client_id", clientId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setConvs((data ?? []) as Conv[]);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("timestamp", { ascending: true });
    setMessages((data ?? []) as Msg[]);
    // mark as read
    await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", convId);
  };

  useEffect(() => {
    loadConvs();
  }, [clientId]);

  useEffect(() => {
    if (active) loadMessages(active.id);
  }, [active?.id]);

  const toggleLead = async () => {
    if (!active) return;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ is_lead: !active.is_lead })
      .eq("id", active.id);
    if (error) return toast.error(error.message);
    setActive({ ...active, is_lead: !active.is_lead });
    loadConvs();
  };

  const closeConv = async () => {
    if (!active) return;
    const next = active.status === "open" ? "closed" : "open";
    await supabase.from("whatsapp_conversations").update({ status: next }).eq("id", active.id);
    setActive({ ...active, status: next });
    loadConvs();
  };

  const togglePauseBot = async () => {
    if (!active) return;
    const next = !active.ai_paused;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ ai_paused: next, pending_response_at: next ? null : active.pending_response_at })
      .eq("id", active.id);
    if (error) return toast.error(error.message);
    setActive({ ...active, ai_paused: next });
    toast.success(next ? "Bot pausado — ahora respondes tú" : "Bot reactivado");
    loadConvs();
  };

  const filtered = convs.filter((c) => {
    if (filterLead && !c.is_lead) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (c.contact_name ?? "").toLowerCase().includes(s) ||
        c.contact_wa_id.includes(s) ||
        (c.last_message_preview ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <Card className="h-[640px] grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden">
      {/* Lista */}
      <div className="border-r flex flex-col min-h-0">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="pl-8 h-9"
              />
            </div>
            <Button size="icon" variant="ghost" onClick={loadConvs} title="Refrescar">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant={filterLead ? "default" : "outline"}
            size="sm"
            className="w-full"
            onClick={() => setFilterLead((v) => !v)}
          >
            <Star className="w-3 h-3 mr-1" /> Solo leads
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Sin conversaciones todavía.
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition ${
                active?.id === c.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="font-medium text-sm truncate flex-1">
                  {c.contact_name || c.contact_wa_id}
                </div>
                {c.is_lead && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                {c.unread_count > 0 && (
                  <Badge className="h-5 px-1.5 text-[10px]">{c.unread_count}</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {c.last_message_preview ?? "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {fmtTime(c.last_message_at)}
              </div>
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Hilo */}
      <div className="flex flex-col min-h-0">
        {!active ? (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <div className="p-3 border-b flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  {active.contact_name || active.contact_wa_id}
                  {active.pending_response_at && !active.ai_paused && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Clock className="w-3 h-3" /> Bot responderá pronto
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">+{active.contact_wa_id}</div>
              </div>
              <Button
                size="sm"
                variant={active.ai_paused ? "default" : "outline"}
                onClick={togglePauseBot}
                title={active.ai_paused ? "Reactivar bot" : "Pausar bot en este chat"}
              >
                {active.ai_paused ? (
                  <><Bot className="w-3 h-3 mr-1" /> Reactivar bot</>
                ) : (
                  <><BotOff className="w-3 h-3 mr-1" /> Pausar bot</>
                )}
              </Button>
              <Button size="sm" variant={active.is_lead ? "default" : "outline"} onClick={toggleLead}>
                <Star className="w-3 h-3 mr-1" />
                {active.is_lead ? "Lead" : "Marcar lead"}
              </Button>
              <Button size="sm" variant="ghost" onClick={closeConv}>
                <X className="w-4 h-4 mr-1" />
                {active.status === "open" ? "Cerrar" : "Reabrir"}
              </Button>
            </div>
            <ScrollArea className="flex-1 p-4 bg-muted/20">
              <div className="space-y-3">
                {messages.map((m) => {
                  const out = m.direction === "outbound";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${out ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          out
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border rounded-bl-sm"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                          {out ? (
                            m.from_bot ? (
                              <>
                                <Bot className="w-3 h-3" /> Bot
                              </>
                            ) : (
                              <>
                                <User className="w-3 h-3" /> Tú
                              </>
                            )
                          ) : (
                            "Cliente"
                          )}
                          <span>· {fmtTime(m.timestamp)}</span>
                        </div>
                        <div className="whitespace-pre-wrap">
                          {m.body || `[${m.type}]`}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Sin mensajes
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </Card>
  );
}
