import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, BotOff, User, Star, X, Search, RefreshCw, Clock, AlertTriangle, Check, Megaphone, Instagram, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { isStale } from "@/hooks/use-unmarked-outcomes";
import { Link } from "@tanstack/react-router";
import {
  OutcomeSelector,
  type Outcome,
  type OutcomeStatus,
} from "@/components/chatbot/OutcomeSelector";


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
  channel: "whatsapp" | "instagram";
  contact_username: string | null;
  tags: string[] | null;
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
  const [filterFollowup, setFilterFollowup] = useState(false);
  const [filterChannel, setFilterChannel] = useState<"all" | "whatsapp" | "instagram">("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [attributions, setAttributions] = useState<Record<string, { ad_id: string | null; headline: string | null }>>({});

  const followupCount = convs.filter((c) => c.needs_human_followup).length;

  const loadConvs = async () => {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("client_id", clientId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setConvs((data ?? []) as Conv[]);
  };

  const loadOutcomes = async () => {
    const { data } = await (supabase.from("conversation_outcomes" as any) as any)
      .select("conversation_id,status,value_clp")
      .eq("client_id", clientId);
    const map: Record<string, Outcome> = {};
    for (const row of (data ?? []) as Outcome[]) map[row.conversation_id] = row;
    setOutcomes(map);
  };

  const loadAttributions = async () => {
    const { data } = await (supabase.from("attributions" as any) as any)
      .select("conversation_id,ad_id,headline")
      .eq("client_id", clientId);
    const map: Record<string, { ad_id: string | null; headline: string | null }> = {};
    for (const row of (data ?? []) as any[]) {
      if (row.conversation_id) map[row.conversation_id] = { ad_id: row.ad_id, headline: row.headline };
    }
    setAttributions(map);
  };

  /** Single tap: upsert the outcome for this conversation. */
  const setOutcome = async (
    convId: string,
    status: OutcomeStatus,
    valueClp: number | null = null,
  ) => {
    const previous = outcomes[convId] ?? null;
    const optimistic: Outcome = {
      conversation_id: convId,
      status,
      value_clp: status === "closed" ? valueClp : null,
    };
    setOutcomes((prev) => ({ ...prev, [convId]: optimistic }));

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase.from("conversation_outcomes" as any) as any).upsert(
      {
        client_id: clientId,
        conversation_id: convId,
        status,
        value_clp: status === "closed" ? valueClp : null,
        marked_by: auth.user?.id ?? null,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id" },
    );
    if (error) {
      setOutcomes((prev) => {
        const next = { ...prev };
        if (previous) next[convId] = previous;
        else delete next[convId];
        return next;
      });
      toast.error(error.message);
    }
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
    loadOutcomes();
    loadAttributions();
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

  const resolveFollowup = async () => {
    if (!active) return;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({
        needs_human_followup: false,
        human_followup_reason: null,
        human_followup_at: null,
      } as any)
      .eq("id", active.id);
    if (error) return toast.error(error.message);
    setActive({ ...active, needs_human_followup: false, human_followup_reason: null, human_followup_at: null });
    toast.success("Recordatorio resuelto");
    loadConvs();
  };

  /** Unmarked and idle for more than 24h → needs an outcome, floats to the top. */
  const needsOutcome = (c: Conv) => !outcomes[c.id] && isStale(c.last_message_at);
  const pendingOutcomeCount = convs.filter(needsOutcome).length;

  /** Tags come from the bot flows; the inbox lets you slice by any of them. */
  const allTags = Array.from(
    new Set(convs.flatMap((c) => c.tags ?? [])),
  ).sort();

  const filtered = convs
    .filter((c) => {
      if (filterTag && !(c.tags ?? []).includes(filterTag)) return false;
      if (filterChannel !== "all" && (c.channel ?? "whatsapp") !== filterChannel) return false;
      if (filterLead && !c.is_lead) return false;
      if (filterFollowup && !c.needs_human_followup) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          (c.contact_name ?? "").toLowerCase().includes(s) ||
          c.contact_wa_id.includes(s) ||
          (c.last_message_preview ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    })
    .sort((a, b) => Number(needsOutcome(b)) - Number(needsOutcome(a)));

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
          <div className="grid grid-cols-3 gap-1">
            {([
              { key: "all", label: "Todos" },
              { key: "whatsapp", label: "WhatsApp" },
              { key: "instagram", label: "Instagram" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterChannel(tab.key)}
                className={`text-[11px] py-1.5 rounded-md border transition ${filterChannel === tab.key ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={filterLead ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterLead((v) => !v)}
            >
              <Star className="w-3 h-3 mr-1" /> Leads
            </Button>
            <Button
              variant={filterFollowup ? "destructive" : "outline"}
              size="sm"
              onClick={() => setFilterFollowup((v) => !v)}
              title="Conversaciones donde la IA derivó al equipo"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              Pendientes{followupCount > 0 ? ` (${followupCount})` : ""}
            </Button>
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTag(filterTag === t ? null : t)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                    filterTag === t
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        {pendingOutcomeCount > 0 && (
          <Link
            to="/clients/$clientId/backfill"
            params={{ clientId }}
            className="block border-b bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/15"
          >
            {pendingOutcomeCount} conversación{pendingOutcomeCount === 1 ? "" : "es"} sin marcar ·
            marcar en lote →
          </Link>
        )}
        <ScrollArea className="flex-1">
          {filtered.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              Sin conversaciones todavía.
            </div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setActive(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setActive(c);
              }}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition cursor-pointer ${
                active?.id === c.id ? "bg-muted" : ""
              } ${c.needs_human_followup ? "border-l-4 border-l-destructive" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span title={c.channel === "instagram" ? "Instagram DM" : "WhatsApp"} className="shrink-0">
                  {c.channel === "instagram" ? (
                    <Instagram className="w-3.5 h-3.5 text-pink-500" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </span>
                <div className="font-medium text-sm truncate flex-1">
                  {c.channel === "instagram" && c.contact_username
                    ? `@${c.contact_username}`
                    : c.contact_name || c.contact_wa_id}
                </div>
                {attributions[c.id] && (
                  <span
                    title={`Desde anuncio${attributions[c.id].headline ? `: ${attributions[c.id].headline}` : ""}`}
                  >
                    <Megaphone className="w-3 h-3 text-sky-500" />
                  </span>
                )}

                {c.needs_human_followup && (
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                )}
                {needsOutcome(c) && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                    Sin marcar
                  </Badge>
                )}
                {c.is_lead && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                {c.unread_count > 0 && (
                  <Badge className="h-5 px-1.5 text-[10px]">{c.unread_count}</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {c.last_message_preview ?? "—"}
              </div>
              {(c.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(c.tags ?? []).slice(0, 4).map((t) => (
                    <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[9px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5 mb-2">
                {fmtTime(c.last_message_at)}
              </div>
              <OutcomeSelector
                outcome={outcomes[c.id] ?? null}
                onSelect={(status) => setOutcome(c.id, status, outcomes[c.id]?.value_clp ?? null)}
                onValue={(value) => setOutcome(c.id, "closed", value)}
              />
            </div>
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
            {active.needs_human_followup && (
              <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/30 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 text-xs">
                  <div className="font-medium text-destructive">
                    Pendiente de respuesta humana
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {active.human_followup_reason ?? "La IA prometió que alguien del equipo contactaría al cliente."}
                    {active.human_followup_at && (
                      <> · {fmtTime(active.human_followup_at)}</>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={resolveFollowup}>
                  <Check className="w-3 h-3 mr-1" /> Resuelto
                </Button>
              </div>
            )}
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
