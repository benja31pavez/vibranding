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
import { Plus, Trash2, X, GripVertical, FileText, Link as LinkIcon, Image as ImageIcon, ListChecks, ShoppingBag, Type, ChevronDown, ChevronRight, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MediaUpload } from "@/components/MediaUpload";
import { BotKnowledgeSection } from "@/components/chatbot/BotKnowledgeSection";

type ActionKind = "text" | "link" | "document" | "image" | "poll" | "catalog";

type CatalogItem = { name: string; price?: string; url?: string; image_url?: string };

type Action =
  | { kind: "text"; body: string }
  | { kind: "link"; url: string; caption?: string }
  | { kind: "document"; url: string; filename?: string; caption?: string }
  | { kind: "image"; url: string; caption?: string }
  | { kind: "poll"; question: string; options: string[] }
  | { kind: "catalog"; title?: string; items: CatalogItem[] };

type Rule = {
  id: string;
  name: string;
  match_type: "keyword" | "exact" | "starts_with" | "fallback";
  keywords: string[];
  response_text: string;
  actions: Action[];
  is_active: boolean;
  priority: number;
  mark_as_lead: boolean;
};

const ACTION_META: Record<ActionKind, { label: string; icon: any }> = {
  text: { label: "Texto", icon: Type },
  link: { label: "Enlace", icon: LinkIcon },
  document: { label: "Documento", icon: FileText },
  image: { label: "Imagen", icon: ImageIcon },
  poll: { label: "Encuesta", icon: ListChecks },
  catalog: { label: "Catálogo", icon: ShoppingBag },
};

function defaultAction(kind: ActionKind): Action {
  switch (kind) {
    case "text":
      return { kind: "text", body: "" };
    case "link":
      return { kind: "link", url: "", caption: "" };
    case "document":
      return { kind: "document", url: "", filename: "", caption: "" };
    case "image":
      return { kind: "image", url: "", caption: "" };
    case "poll":
      return { kind: "poll", question: "", options: ["", ""] };
    case "catalog":
      return { kind: "catalog", title: "", items: [{ name: "" }] };
  }
}

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
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate">{rule.name}</span>
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
            <Label className="text-xs">Acciones que enviará el bot</Label>
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

function ActionEditor({
  clientId,
  action,
  onChange,
  onRemove,
  onMove,
}: {
  clientId: string;
  action: Action;
  onChange: (p: Partial<Action>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const Meta = ACTION_META[action.kind];
  const Icon = Meta.icon;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onMove(-1)}
          className="text-muted-foreground hover:text-foreground"
          title="Subir"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium flex-1">{Meta.label}</span>
        <Button size="icon" variant="ghost" onClick={onRemove} className="h-7 w-7">
          <X className="w-3 h-3" />
        </Button>
      </div>

      {action.kind === "text" && (
        <Textarea
          value={action.body}
          onChange={(e) => onChange({ body: e.target.value } as Partial<Action>)}
          rows={3}
          placeholder="Mensaje que enviará el bot"
        />
      )}

      {action.kind === "link" && (
        <div className="space-y-2">
          <Input
            value={action.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<Action>)}
            placeholder="https://tusitio.com"
          />
          <Input
            value={action.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<Action>)}
            placeholder="Texto opcional antes del enlace"
          />
        </div>
      )}

      {action.kind === "image" && (
        <div className="space-y-2">
          <MediaUpload
            clientId={clientId}
            value={action.url || null}
            onChange={(url) => onChange({ url: url ?? "" } as Partial<Action>)}
            placeholder="URL de la imagen"
          />
          <Input
            value={action.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<Action>)}
            placeholder="Pie de imagen (opcional)"
          />
        </div>
      )}

      {action.kind === "document" && (
        <div className="space-y-2">
          <Input
            value={action.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<Action>)}
            placeholder="URL pública del documento (PDF, etc.)"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={action.filename ?? ""}
              onChange={(e) =>
                onChange({ filename: e.target.value } as Partial<Action>)
              }
              placeholder="Nombre del archivo (ej. catalogo.pdf)"
            />
            <Input
              value={action.caption ?? ""}
              onChange={(e) =>
                onChange({ caption: e.target.value } as Partial<Action>)
              }
              placeholder="Mensaje opcional"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            WhatsApp requiere una URL pública. Sube el archivo a tu servidor o usa un enlace
            directo.
          </p>
        </div>
      )}

      {action.kind === "poll" && (
        <PollEditor action={action} onChange={onChange} />
      )}

      {action.kind === "catalog" && (
        <CatalogEditor clientId={clientId} action={action} onChange={onChange} />
      )}
    </div>
  );
}

function PollEditor({
  action,
  onChange,
}: {
  action: Extract<Action, { kind: "poll" }>;
  onChange: (p: Partial<Action>) => void;
}) {
  const setOption = (i: number, v: string) => {
    const next = [...action.options];
    next[i] = v;
    onChange({ options: next } as Partial<Action>);
  };
  const addOption = () => {
    if (action.options.length >= 10) return;
    onChange({ options: [...action.options, ""] } as Partial<Action>);
  };
  const removeOption = (i: number) =>
    onChange({ options: action.options.filter((_, j) => j !== i) } as Partial<Action>);

  return (
    <div className="space-y-2">
      <Input
        value={action.question}
        onChange={(e) => onChange({ question: e.target.value } as Partial<Action>)}
        placeholder="Pregunta de la encuesta"
      />
      <div className="space-y-1.5">
        {action.options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={o}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Opción ${i + 1}`}
              maxLength={24}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeOption(i)}
              className="h-9 w-9"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={addOption}
          disabled={action.options.length >= 10}
        >
          <Plus className="w-3 h-3 mr-1" /> Opción
        </Button>
        <p className="text-[10px] text-muted-foreground">
          1-3 opciones → botones. 4-10 → lista desplegable.
        </p>
      </div>
    </div>
  );
}

function CatalogEditor({
  clientId,
  action,
  onChange,
}: {
  clientId: string;
  action: Extract<Action, { kind: "catalog" }>;
  onChange: (p: Partial<Action>) => void;
}) {
  const updateItem = (i: number, patch: Partial<CatalogItem>) => {
    const next = action.items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    onChange({ items: next } as Partial<Action>);
  };
  const addItem = () =>
    onChange({ items: [...action.items, { name: "" }] } as Partial<Action>);
  const removeItem = (i: number) =>
    onChange({ items: action.items.filter((_, j) => j !== i) } as Partial<Action>);

  return (
    <div className="space-y-2">
      <Input
        value={action.title ?? ""}
        onChange={(e) => onChange({ title: e.target.value } as Partial<Action>)}
        placeholder="Encabezado (ej: 'Estos son nuestros productos:')"
      />
      <div className="space-y-2">
        {action.items.map((it, i) => (
          <div key={i} className="border rounded-md p-2 bg-background space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
              <Input
                value={it.name}
                onChange={(e) => updateItem(i, { name: e.target.value })}
                placeholder="Nombre del producto"
                className="flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeItem(i)}
                className="h-7 w-7"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={it.price ?? ""}
                onChange={(e) => updateItem(i, { price: e.target.value })}
                placeholder="Precio (ej: $25.000)"
              />
              <Input
                value={it.url ?? ""}
                onChange={(e) => updateItem(i, { url: e.target.value })}
                placeholder="Enlace al producto"
              />
            </div>
            <MediaUpload
              clientId={clientId}
              value={it.image_url || null}
              onChange={(url) => updateItem(i, { image_url: url ?? undefined })}
              placeholder="URL de la imagen"
            />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={addItem}
        disabled={action.items.length >= 10}
      >
        <Plus className="w-3 h-3 mr-1" /> Producto
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Máximo 10 productos. Cada producto se envía como un mensaje con su imagen, precio y
        enlace.
      </p>
    </div>
  );
}
