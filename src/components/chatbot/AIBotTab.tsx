import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import type { WAAccount } from "@/components/pages/ChatbotPage";

const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash · rápido y barato (default)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash · equilibrado" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro · más preciso" },
  { value: "openai/gpt-5-mini", label: "GPT-5 mini · razonamiento OpenAI" },
  { value: "openai/gpt-5", label: "GPT-5 · máxima calidad (más caro)" },
];

export function AIBotTab({ clientId, account, onChange }: {
  clientId: string;
  account: WAAccount;
  onChange: () => void;
}) {
  const [enabled, setEnabled] = useState(account.ai_enabled);
  const [model, setModel] = useState(account.ai_model);
  const [prompt, setPrompt] = useState(account.ai_system_prompt);
  const [context, setContext] = useState(account.ai_business_context ?? "");
  const [debounce, setDebounce] = useState<number>(account.ai_debounce_seconds);
  const [maxHistory, setMaxHistory] = useState<number>(account.ai_max_history);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(account.ai_enabled);
    setModel(account.ai_model);
    setPrompt(account.ai_system_prompt);
    setContext(account.ai_business_context ?? "");
    setDebounce(account.ai_debounce_seconds);
    setMaxHistory(account.ai_max_history);
  }, [account.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("whatsapp_accounts")
      .update({
        ai_enabled: enabled,
        ai_model: model,
        ai_system_prompt: prompt,
        ai_business_context: context || null,
        ai_debounce_seconds: debounce,
        ai_max_history: maxHistory,
      })
      .eq("id", account.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuración IA guardada");
    onChange();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Asistente con IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cuando el cliente escribe varios mensajes seguidos, el bot espera{" "}
              <strong>{debounce}s</strong> a que termine, los agrupa y responde una sola vez con IA usando todo el contexto del chat.
              Las reglas tipo <em>keyword</em> siguen respondiendo al instante; el fallback queda a cargo de la IA.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Activar respuestas con IA</Label>
              <p className="text-xs text-muted-foreground">
                Si está apagado, solo responden las reglas keyword.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label className="text-xs">Modelo de IA</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Persona / instrucciones del bot</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Eres el asistente comercial de [Negocio]. Tono cercano, responde en español..."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Cómo debe hablar y qué rol cumple el bot.
            </p>
          </div>

          <div>
            <Label className="text-xs">Contexto del negocio (precios, horarios, FAQ…)</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={6}
              placeholder={`Ej:\n- Servicios: gestión Instagram desde 250€/mes, Meta Ads desde 350€/mes\n- Horario: L-V 9-18h\n- No realizamos diseño de logos`}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Toda esta info se inyecta al prompt del sistema para que el bot responda con datos reales.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Espera antes de responder</Label>
                <span className="text-xs font-mono">{debounce}s</span>
              </div>
              <Slider
                value={[debounce]}
                min={15}
                max={180}
                step={5}
                onValueChange={([v]) => setDebounce(v)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Tiempo que espera a ver si el usuario manda más mensajes. Recomendado 60-90s.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Mensajes de historial</Label>
                <span className="text-xs font-mono">{maxHistory}</span>
              </div>
              <Slider
                value={[maxHistory]}
                min={4}
                max={50}
                step={2}
                onValueChange={([v]) => setMaxHistory(v)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Cuántos mensajes recientes le pasamos al modelo como contexto.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar configuración IA"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
