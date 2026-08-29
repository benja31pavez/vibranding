import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Workflow,
  X,
} from "lucide-react";
import {
  ActionEditor,
  ACTION_META,
  defaultAction,
  type Action,
  type ActionKind,
} from "@/components/chatbot/ActionEditor";
import {
  COMMON_VARIABLES,
  END_STEP,
  STEP_LABEL,
  defaultStep,
  newStepId,
  type FlowStep,
  type FlowStepKind,
} from "@/lib/whatsapp/flowTypes";

const STEP_ICON: Record<FlowStepKind, any> = {
  message: MessageSquare,
  question: Workflow,
  delay: Clock,
  tag: Tag,
  save_lead: UserPlus,
  handoff: UserCheck,
};

function stepSummary(step: FlowStep): string {
  switch (step.kind) {
    case "message": {
      const first = (step.actions ?? [])[0] as any;
      return first?.body || first?.caption || first?.question || first?.url || "Sin contenido";
    }
    case "question":
      return step.prompt || "Sin pregunta";
    case "delay":
      return `Esperar ${step.delay_seconds ?? 60} s`;
    case "tag":
      return (step.tags ?? []).join(", ") || "Sin etiquetas";
    case "save_lead":
      return "Guarda las respuestas como lead";
    case "handoff":
      return step.reason || "Avisa al equipo";
  }
}

export function FlowEditor({
  clientId,
  steps,
  onChange,
}: {
  clientId: string;
  steps: FlowStep[];
  onChange: (steps: FlowStep[]) => void;
}) {
  const [open, setOpen] = useState(steps.length > 0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const patch = (id: string, p: Partial<FlowStep>) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const addStep = (kind: FlowStepKind) => {
    const step = defaultStep(kind);
    onChange([...steps, step]);
    setExpanded(step.id);
    setOpen(true);
  };

  const removeStep = (id: string) => onChange(steps.filter((s) => s.id !== id));

  const move = (idx: number, dir: -1 | 1) => {
    const arr = [...steps];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    onChange(arr);
  };

  const targetOptions = (currentId: string) => [
    { value: "__next__", label: "Paso siguiente" },
    ...steps
      .filter((s) => s.id !== currentId)
      .map((s, i) => ({
        value: s.id,
        label: `${steps.findIndex((x) => x.id === s.id) + 1}. ${STEP_LABEL[s.kind]}${
          s.label ? ` — ${s.label}` : ""
        }`,
        _i: i,
      })),
    { value: END_STEP, label: "Terminar el flujo" },
  ];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Workflow className="w-4 h-4" />
        Flujo de varios pasos
        {steps.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {steps.length} paso{steps.length === 1 ? "" : "s"}
          </Badge>
        )}
      </button>

      {open && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Si defines pasos, el bot ejecuta el flujo en vez de la respuesta simple de arriba.
            Puedes usar <code className="bg-secondary px-1 rounded">{"{{name}}"}</code> o cualquier
            variable capturada dentro de los textos. El contacto puede escribir «cancelar» para
            salir.
          </p>

          <div className="flex flex-wrap gap-1">
            {(Object.keys(STEP_LABEL) as FlowStepKind[]).map((k) => {
              const Icon = STEP_ICON[k];
              return (
                <Button
                  key={k}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => addStep(k)}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {STEP_LABEL[k]}
                </Button>
              );
            })}
          </div>

          {steps.length === 0 ? (
            <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-4 text-center">
              Sin pasos: esta regla responde con las acciones simples de arriba.
            </div>
          ) : (
            <ol className="space-y-2">
              {steps.map((step, idx) => {
                const Icon = STEP_ICON[step.kind];
                const isOpen = expanded === step.id;
                return (
                  <li key={step.id} className="rounded-xl border bg-background">
                    <div className="flex items-center gap-2 p-2.5">
                      <span className="w-6 h-6 shrink-0 rounded-full bg-secondary text-xs grid place-items-center font-medium">
                        {idx + 1}
                      </span>
                      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : step.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className="text-sm font-medium">{STEP_LABEL[step.kind]}</span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {stepSummary(step)}
                        </span>
                      </button>
                      <Button size="icon" variant="ghost" onClick={() => move(idx, -1)}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => move(idx, 1)}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeStep(step.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="border-t p-3 space-y-3">
                        <div>
                          <Label className="text-xs">Nombre interno (opcional)</Label>
                          <Input
                            value={step.label ?? ""}
                            onChange={(e) => patch(step.id, { label: e.target.value })}
                            placeholder="Ej: Preguntar presupuesto"
                          />
                        </div>

                        {step.kind === "message" && (
                          <MessageStepFields
                            clientId={clientId}
                            step={step}
                            patch={(p) => patch(step.id, p)}
                          />
                        )}

                        {step.kind === "question" && (
                          <QuestionStepFields
                            step={step}
                            patch={(p) => patch(step.id, p)}
                            targets={targetOptions(step.id)}
                          />
                        )}

                        {step.kind === "delay" && (
                          <div>
                            <Label className="text-xs">Esperar antes del siguiente paso</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={5}
                                value={step.delay_seconds ?? 60}
                                onChange={(e) =>
                                  patch(step.id, {
                                    delay_seconds: Math.max(5, Number(e.target.value) || 60),
                                  })
                                }
                                className="w-32"
                              />
                              <span className="text-xs text-muted-foreground">
                                segundos (el reloj del bot revisa cada minuto)
                              </span>
                            </div>
                          </div>
                        )}

                        {step.kind === "tag" && (
                          <TagsField
                            tags={step.tags ?? []}
                            onChange={(tags) => patch(step.id, { tags })}
                          />
                        )}

                        {step.kind === "save_lead" && (
                          <p className="text-xs text-muted-foreground">
                            Guarda al contacto en Leads con todas las variables capturadas
                            (nombre, correo, presupuesto…) y lo marca como lead.
                          </p>
                        )}

                        {step.kind === "handoff" && (
                          <div>
                            <Label className="text-xs">Motivo para el equipo</Label>
                            <Input
                              value={step.reason ?? ""}
                              onChange={(e) => patch(step.id, { reason: e.target.value })}
                              placeholder="Pide hablar con una persona"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Marca la conversación como pendiente y pausa la IA.
                            </p>
                          </div>
                        )}

                        {step.kind !== "question" && (
                          <div>
                            <Label className="text-xs">Después de este paso</Label>
                            <Select
                              value={step.next_step_id ?? "__next__"}
                              onValueChange={(v) =>
                                patch(step.id, {
                                  next_step_id: v === "__next__" ? null : v,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {targetOptions(step.id).map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function MessageStepFields({
  clientId,
  step,
  patch,
}: {
  clientId: string;
  step: FlowStep;
  patch: (p: Partial<FlowStep>) => void;
}) {
  const actions = (step.actions ?? []) as Action[];
  const setActions = (a: Action[]) => patch({ actions: a });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Contenido que envía el bot</Label>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(ACTION_META) as ActionKind[]).map((k) => {
            const Icon = ACTION_META[k].icon;
            return (
              <Button
                key={k}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setActions([...actions, defaultAction(k)])}
              >
                <Icon className="w-3 h-3 mr-1" />
                {ACTION_META[k].label}
              </Button>
            );
          })}
        </div>
      </div>
      {actions.length === 0 && (
        <p className="text-xs text-muted-foreground">Agrega al menos un contenido.</p>
      )}
      {actions.map((a, i) => (
        <ActionEditor
          key={i}
          clientId={clientId}
          action={a}
          onChange={(p) =>
            setActions(actions.map((x, j) => (j === i ? ({ ...x, ...p } as Action) : x)))
          }
          onRemove={() => setActions(actions.filter((_, j) => j !== i))}
          onMove={(d) => {
            const arr = [...actions];
            const j = i + d;
            if (j < 0 || j >= arr.length) return;
            [arr[i], arr[j]] = [arr[j], arr[i]];
            setActions(arr);
          }}
        />
      ))}
    </div>
  );
}

function QuestionStepFields({
  step,
  patch,
  targets,
}: {
  step: FlowStep;
  patch: (p: Partial<FlowStep>) => void;
  targets: { value: string; label: string }[];
}) {
  const choices = step.choices ?? [];
  const conditions = step.conditions ?? [];
  const mode = step.reply_mode ?? "buttons";

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Pregunta</Label>
        <Textarea
          rows={2}
          value={step.prompt ?? ""}
          onChange={(e) => patch({ prompt: e.target.value })}
          placeholder="¿Cuál es tu presupuesto aproximado?"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Tipo de respuesta</Label>
          <Select value={mode} onValueChange={(v) => patch({ reply_mode: v as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buttons">Botones (hasta 3)</SelectItem>
              <SelectItem value="list">Lista de opciones</SelectItem>
              <SelectItem value="text">Texto libre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "text" && (
          <div>
            <Label className="text-xs">Validar como</Label>
            <Select
              value={step.input_type ?? "text"}
              onValueChange={(v) => patch({ input_type: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="email">Correo</SelectItem>
                <SelectItem value="number">Número</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs">Guardar respuesta en</Label>
          <Input
            value={step.variable ?? ""}
            onChange={(e) => patch({ variable: e.target.value.trim() })}
            placeholder="name, email, budget…"
            list={`vars-${step.id}`}
          />
          <datalist id={`vars-${step.id}`}>
            {COMMON_VARIABLES.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
      </div>

      {mode !== "text" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Opciones y a dónde llevan</Label>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => patch({ choices: [...choices, { id: newStepId(), label: "" }] })}
            >
              <Plus className="w-3 h-3 mr-1" /> Opción
            </Button>
          </div>
          {choices.map((c, i) => (
            <div key={c.id} className="flex flex-col sm:flex-row gap-2">
              <Input
                value={c.label}
                maxLength={mode === "buttons" ? 20 : 24}
                onChange={(e) =>
                  patch({
                    choices: choices.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
                placeholder={`Opción ${i + 1}`}
                className="sm:flex-1"
              />
              <Select
                value={c.next_step_id ?? "__next__"}
                onValueChange={(v) =>
                  patch({
                    choices: choices.map((x, j) =>
                      j === i ? { ...x, next_step_id: v === "__next__" ? null : v } : x,
                    ),
                  })
                }
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => patch({ choices: choices.filter((_, j) => j !== i) })}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            Con 1–3 opciones se envían botones; con 4 o más, una lista desplegable.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ramificar según lo que escriba</Label>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                patch({ conditions: [...conditions, { match: "contains", value: "" }] })
              }
            >
              <Plus className="w-3 h-3 mr-1" /> Condición
            </Button>
          </div>
          {conditions.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Sin condiciones, cualquier respuesta continúa al paso siguiente.
            </p>
          )}
          {conditions.map((c, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <Select
                value={c.match}
                onValueChange={(v) =>
                  patch({
                    conditions: conditions.map((x, j) =>
                      j === i ? { ...x, match: v as any } : x,
                    ),
                  })
                }
              >
                <SelectTrigger className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contiene</SelectItem>
                  <SelectItem value="equals">Es igual a</SelectItem>
                  <SelectItem value="starts_with">Empieza con</SelectItem>
                  <SelectItem value="any">Cualquier respuesta</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={c.value}
                onChange={(e) =>
                  patch({
                    conditions: conditions.map((x, j) =>
                      j === i ? { ...x, value: e.target.value } : x,
                    ),
                  })
                }
                placeholder="palabra o frase"
                className="sm:flex-1"
                disabled={c.match === "any"}
              />
              <Select
                value={c.next_step_id ?? "__next__"}
                onValueChange={(v) =>
                  patch({
                    conditions: conditions.map((x, j) =>
                      j === i ? { ...x, next_step_id: v === "__next__" ? null : v } : x,
                    ),
                  })
                }
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => patch({ conditions: conditions.filter((_, j) => j !== i) })}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <Label className="text-xs">Si no coincide ninguna opción</Label>
        <Select
          value={step.next_step_id ?? "__next__"}
          onValueChange={(v) => patch({ next_step_id: v === "__next__" ? null : v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targets.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TagsField({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (!t || tags.includes(t)) return setInput("");
    onChange([...tags, t]);
    setInput("");
  };
  return (
    <div>
      <Label className="text-xs">Etiquetas que se agregan a la conversación</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ej: presupuesto-alto"
        />
        <Button variant="outline" onClick={add}>
          Añadir
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
