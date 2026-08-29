import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, X, ChevronDown, ChevronRight, Check, Pencil, Workflow } from "lucide-react";
import { toast } from "sonner";
import { BotKnowledgeSection } from "@/components/chatbot/BotKnowledgeSection";
import {
  ActionEditor,
  ACTION_META,
  defaultAction,
  type Action,
  type ActionKind,
} from "@/components/chatbot/ActionEditor";
import { FlowEditor } from "@/components/chatbot/FlowEditor";
import type { FlowStep } from "@/lib/whatsapp/flowTypes";

type Rule = {
  id: string;
  name: string;
  match_type: string;
  keywords: string[];
  response_text: string | null;
  actions: Action[];
  is_active: boolean;
  priority: number;
  mark_as_lead: boolean;
  flow_steps: FlowStep[];
};

export function BotRulesTab({ clientId }: { clientId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_bot_rules")
      .select("*")
      .eq("client_id", clientId)
      .order("priority", { ascending: false });
    const normalized = ((data ?? []) as any[]).map((r) => ({
      ...r,
      actions: Array.isArray(r.actions) ? r.actions : [],
      flow_steps: Array.isArray(r.flow_steps) ? r.flow_steps : [],
    })) as Rule[];
    setRules(normalized);
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
    const { error } = await supabase
      .from("whatsapp_bot_rules")
      .update(patch as any)
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar regla?")) return;
    await supabase.from("whatsapp_bot_rules").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <BotKnowledgeSection clientId={clientId} />

      <div className="flex items-center justify-between pt-2">
        <h2 className="font-semibold">Reglas de respuestas automáticas</h2>
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
        <RuleEditor
          key={r.id}
          clientId={clientId}
          rule={r}
          onChange={(p) => update(r.id, p)}
          onDelete={() => remove(r.id)}
        />
      ))}
    </div>
  );
}

function RuleEditor({
  clientId,
  rule,
  onChange,
  onDelete,
}: {
  clientId: string;
  rule: Rule;
  onChange: (p: Partial<Rule>) => void;
  onDelete: () => void;
}) {
  const [kwInput, setKwInput] = useState("");
  // New rules (name "Nueva regla" and no actions/keywords) start expanded; the rest collapsed.
  const isFresh =
    rule.name === "Nueva regla" &&
    (rule.actions ?? []).length === 0 &&
    rule.keywords.length === 0;
  const [collapsed, setCollapsed] = useState(!isFresh);

  const addKeyword = () => {
    const k = kwInput.trim();
    if (!k) return;
    if (rule.keywords.includes(k)) return setKwInput("");
    onChange({ keywords: [...rule.keywords, k] });
    setKwInput("");
  };

  const removeKw = (k: string) =>
    onChange({ keywords: rule.keywords.filter((x) => x !== k) });

  const setActions = (actions: Action[]) => onChange({ actions });

  const addAction = (kind: ActionKind) =>
    setActions([...(rule.actions ?? []), defaultAction(kind)]);

  const updateAction = (idx: number, patch: Partial<Action>) => {
    const next = (rule.actions ?? []).map((a, i) =>
      i === idx ? ({ ...a, ...patch } as Action) : a,
    );
    setActions(next);
  };

  const removeAction = (idx: number) =>
    setActions((rule.actions ?? []).filter((_, i) => i !== idx));

  const moveAction = (idx: number, dir: -1 | 1) => {
    const arr = [...(rule.actions ?? [])];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setActions(arr);
  };

  // Auto-migrate legacy response_text into a text action if there are no actions yet
  const effectiveActions: Action[] =
    (rule.actions ?? []).length === 0 && rule.response_text
      ? [{ kind: "text", body: rule.response_text }]
      : rule.actions ?? [];

  const actionsCount = effectiveActions.length;
  const matchLabel: Record<Rule["match_type"], string> = {
    keyword: "Contiene",
    starts_with: "Empieza con",
    exact: "Exacto",
    fallback: "Fallback",
  };

  if (collapsed) {
    return (
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(false)}
              className="text-muted-foreground hover:text-foreground"
              title="Expandir"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="font-medium truncate">{rule.name}</span>
              {(rule.flow_steps ?? []).length > 0 && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Workflow className="w-3 h-3" />
                  Flujo de {rule.flow_steps.length} paso{rule.flow_steps.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
            <Switch
              checked={rule.is_active}
              onCheckedChange={(v) => onChange({ is_active: v })}
            />
            <Button size="icon" variant="ghost" onClick={() => setCollapsed(false)}>
              <Pencil className="w-4 h-4" />
            </Button>

          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(true)}
            className="text-muted-foreground hover:text-foreground"
            title="Colapsar"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <Input
            value={rule.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="font-medium"
            placeholder="Nombre de la regla"
          />
          <Switch
            checked={rule.is_active}
            onCheckedChange={(v) => onChange({ is_active: v })}
          />
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Tipo de coincidencia</Label>
            <Select
              value={rule.match_type}
              onValueChange={(v) => onChange({ match_type: v as Rule["match_type"] })}
            >
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Respuesta simple (un solo paso)</Label>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(ACTION_META) as ActionKind[]).map((k) => {
                const Icon = ACTION_META[k].icon;
                return (
                  <Button
                    key={k}
                    size="sm"
                    variant="outline"
                    onClick={() => addAction(k)}
                    className="h-7 text-xs"
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {ACTION_META[k].label}
                  </Button>
                );
              })}
            </div>
          </div>

          {effectiveActions.length === 0 && (
            <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
              Agrega al menos una acción (texto, enlace, documento, imagen, encuesta o catálogo).
            </div>
          )}

          <div className="space-y-2">
            {effectiveActions.map((a, idx) => (
              <ActionEditor
                key={idx}
                clientId={clientId}
                action={a}
                onChange={(p) => updateAction(idx, p)}
                onRemove={() => removeAction(idx)}
                onMove={(d) => moveAction(idx, d)}
              />
            ))}
          </div>
        </div>

        <div className="pt-3 border-t">
          <FlowEditor
            clientId={clientId}
            steps={rule.flow_steps ?? []}
            onChange={(flow_steps) => onChange({ flow_steps })}
          />
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button
            onClick={() => {
              // Persistence is automatic on each edit; this just collapses the card.
              setCollapsed(true);
              toast.success("Regla guardada");
            }}
          >
            <Check className="w-4 h-4 mr-1" /> Guardar regla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
