import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type KItem = {
  id: string;
  question: string;
  answer: string | null;
  origin: "onboarding" | "auto";
  status: "pending" | "answered" | "dismissed";
  context_snippet: string | null;
  sort_order: number;
};

const ONBOARDING: string[] = [
  "¿A qué se dedica tu negocio? Descríbelo en 2-3 frases.",
  "¿Cuál es el producto o servicio principal que ofreces?",
  "¿Cuáles son los precios o rangos de precios principales?",
  "¿Cuáles son las 3 preguntas que más te hacen los clientes y cómo las respondes?",
  "¿Qué métodos de pago aceptas?",
  "¿Tienes despachos / envíos? ¿A qué zonas y con qué costo aproximado?",
  "¿Cuál es tu política de garantías, cambios o devoluciones?",
  "¿Qué tono debe usar el bot? (cercano, formal, divertido, técnico, etc.)",
  "¿Hay temas que el bot NO debe responder y mejor derive a un humano?",
  "¿Cuándo y bajo qué condiciones debe el bot ofrecer agendar una reunión?",
  "¿Qué información debe pedir siempre al cliente antes de derivarte un lead?",
  "¿Hay promociones o descuentos vigentes que el bot debería mencionar?",
];

export function BotKnowledgeSection({ clientId }: { clientId: string }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [items, setItems] = useState<KItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    const { data: acc } = await supabase
      .from("whatsapp_accounts")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!acc) return;
    setAccountId(acc.id);

    const { data } = await (supabase.from("bot_knowledge" as any) as any)
      .select("*")
      .eq("account_id", acc.id)
      .order("status", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    let list = (data ?? []) as KItem[];

    // Seed onboarding if empty
    if (list.length === 0) {
      const rows = ONBOARDING.map((q, i) => ({
        account_id: acc.id,
        client_id: clientId,
        question: q,
        origin: "onboarding",
        sort_order: i,
      }));
      await (supabase.from("bot_knowledge" as any) as any).insert(rows);
      const { data: d2 } = await (supabase.from("bot_knowledge" as any) as any)
        .select("*")
        .eq("account_id", acc.id)
        .order("status", { ascending: true })
        .order("sort_order", { ascending: true });
      list = (d2 ?? []) as KItem[];
    }
    setItems(list);
    setDrafts(Object.fromEntries(list.map((k) => [k.id, k.answer ?? ""])));
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const save = async (id: string) => {
    const answer = drafts[id]?.trim();
    if (!answer) return;
    const { error } = await (supabase.from("bot_knowledge" as any) as any)
      .update({ answer, status: "answered", answered_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Respuesta guardada — el bot ya la usará");
    load();
  };

  const dismiss = async (id: string) => {
    await (supabase.from("bot_knowledge" as any) as any)
      .update({ status: "dismissed" })
      .eq("id", id);
    load();
  };

  const reopen = async (id: string) => {
    await (supabase.from("bot_knowledge" as any) as any).update({ status: "pending" }).eq("id", id);
    load();
  };

  if (!accountId) return null;

  const pending = items.filter((i) => i.status === "pending");
  const answered = items.filter((i) => i.status === "answered");

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 text-left"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Brain className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <div className="font-semibold">Aprendizaje del bot</div>
            <div className="text-xs text-muted-foreground">
              Responde estas preguntas para que el bot sea mucho más inteligente. Tus respuestas se
              inyectan en el contexto del bot automáticamente.
            </div>
          </div>
          {pending.length > 0 && (
            <Badge variant="default">
              {pending.length} pendiente{pending.length === 1 ? "" : "s"}
            </Badge>
          )}
          {answered.length > 0 && (
            <Badge variant="secondary">
              {answered.length} respondida{answered.length === 1 ? "" : "s"}
            </Badge>
          )}
        </button>

        {!collapsed && (
          <div className="space-y-3 pt-2">
            {pending.length === 0 && answered.length === 0 && (
              <div className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded">
                Aún no hay preguntas.
              </div>
            )}

            {pending.map((q) => (
              <div key={q.id} className="border rounded-lg p-3 bg-muted/20 space-y-2">
                <div className="flex items-start gap-2">
                  {q.origin === "auto" && (
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-1 shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{q.question}</div>
                    {q.context_snippet && (
                      <div className="text-[11px] text-muted-foreground mt-1 italic">
                        Contexto del chat: "{q.context_snippet}"
                      </div>
                    )}
                  </div>
                </div>
                <Textarea
                  value={drafts[q.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                  rows={2}
                  placeholder="Tu respuesta…"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => dismiss(q.id)}>
                    <X className="w-3 h-3 mr-1" /> Descartar
                  </Button>
                  <Button size="sm" onClick={() => save(q.id)}>
                    <Check className="w-3 h-3 mr-1" /> Guardar
                  </Button>
                </div>
              </div>
            ))}

            {answered.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Ver {answered.length} respondida{answered.length === 1 ? "" : "s"}
                </summary>
                <div className="space-y-2 mt-2">
                  {answered.map((q) => (
                    <div key={q.id} className="border rounded p-2">
                      <div className="font-medium">{q.question}</div>
                      <div className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {q.answer}
                      </div>
                      <button
                        onClick={() => reopen(q.id)}
                        className="text-[10px] text-primary mt-1 hover:underline"
                      >
                        Editar
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
