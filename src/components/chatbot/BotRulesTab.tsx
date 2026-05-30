import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  id: string;
  name: string;
  match_type: "keyword" | "exact" | "starts_with" | "fallback";
  keywords: string[];
  response_text: string;
  is_active: boolean;
  priority: number;
  mark_as_lead: boolean;
};

export function BotRulesTab({ clientId }: { clientId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_bot_rules")
      .select("*")
      .eq("client_id", clientId)
      .order("priority", { ascending: false });
    setRules((data ?? []) as Rule[]);
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const add = async () => {
    const { error } = await supabase
      .from("whatsapp_bot_rules")
      .insert({ client_id: clientId, name: "Nueva regla", priority: rules.length });
    if (error) return toast.error(error.message);
    load();
  };

  const update = async (id: string, patch: Partial<Rule>) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("whatsapp_bot_rules").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar regla?")) return;
    await supabase.from("whatsapp_bot_rules").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Reglas de respuestas automáticas</h2>
          <p className="text-xs text-muted-foreground">
            Se evalúan por prioridad (mayor primero). Las reglas tipo <em>fallback</em> responden si
            ninguna otra coincide.
          </p>
        </div>
        <Button onClick={add}>
          <Plus className="w-4 h-4 mr-1" /> Nueva regla
        </Button>
      </div>

      {rules.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Aún no tienes reglas. Crea la primera para que el bot empiece a responder.
          </CardContent>
        </Card>
      )}

      {rules.map((r) => (
        <RuleEditor key={r.id} rule={r} onChange={(p) => update(r.id, p)} onDelete={() => remove(r.id)} />
      ))}
    </div>
  );
}

function RuleEditor({
  rule,
  onChange,
  onDelete,
}: {
  rule: Rule;
  onChange: (p: Partial<Rule>) => void;
  onDelete: () => void;
}) {
  const [kwInput, setKwInput] = useState("");

  const addKeyword = () => {
    const k = kwInput.trim();
    if (!k) return;
    if (rule.keywords.includes(k)) return setKwInput("");
    onChange({ keywords: [...rule.keywords, k] });
    setKwInput("");
  };

  const removeKw = (k: string) => onChange({ keywords: rule.keywords.filter((x) => x !== k) });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={rule.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="font-medium"
            placeholder="Nombre de la regla"
          />
          <Switch checked={rule.is_active} onCheckedChange={(v) => onChange({ is_active: v })} />
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Tipo de coincidencia</Label>
            <Select value={rule.match_type} onValueChange={(v) => onChange({ match_type: v as Rule["match_type"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Contiene palabra</SelectItem>
                <SelectItem value="starts_with">Empieza con</SelectItem>
                <SelectItem value="exact">Texto exacto</SelectItem>
                <SelectItem value="fallback">Fallback (si nada coincide)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prioridad</Label>
            <Input
              type="number"
              value={rule.priority}
              onChange={(e) => onChange({ priority: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-end gap-2">
            <Switch
              id={`lead-${rule.id}`}
              checked={rule.mark_as_lead}
              onCheckedChange={(v) => onChange({ mark_as_lead: v })}
            />
            <Label htmlFor={`lead-${rule.id}`} className="text-xs">
              Marcar al contacto como lead
            </Label>
          </div>
        </div>

        {rule.match_type !== "fallback" && (
          <div>
            <Label className="text-xs">Palabras / frases clave</Label>
            <div className="flex gap-2">
              <Input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Agrega y presiona Enter"
              />
              <Button onClick={addKeyword} variant="outline">
                Añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {rule.keywords.map((k) => (
                <Badge key={k} variant="secondary" className="gap-1">
                  {k}
                  <button onClick={() => removeKw(k)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Respuesta</Label>
          <Textarea
            value={rule.response_text}
            onChange={(e) => onChange({ response_text: e.target.value })}
            rows={3}
            placeholder="Texto que el bot enviará automáticamente"
          />
        </div>
      </CardContent>
    </Card>
  );
}
