// Shared (client + server) shapes for multi-step WhatsApp bot flows.
// A rule without flow_steps keeps behaving exactly as before: it just fires its actions.

export type FlowActionKind = "text" | "link" | "document" | "image" | "poll" | "catalog";

export type FlowStepKind = "message" | "question" | "delay" | "tag" | "save_lead" | "handoff";

export type FlowChoice = {
  id: string;
  label: string;
  /** Step to jump to when this option is chosen. null = next step in the list. */
  next_step_id?: string | null;
};

export type FlowCondition = {
  match: "contains" | "equals" | "starts_with" | "any";
  value: string;
  next_step_id?: string | null;
};

export type FlowStep = {
  id: string;
  kind: FlowStepKind;
  label?: string;
  /** message: reuses the same action payloads as single-step rules. */
  actions?: any[];
  /** question */
  prompt?: string;
  reply_mode?: "buttons" | "list" | "text";
  choices?: FlowChoice[];
  input_type?: "text" | "email" | "number";
  variable?: string;
  conditions?: FlowCondition[];
  /** delay */
  delay_seconds?: number;
  /** tag */
  tags?: string[];
  /** handoff */
  reason?: string;
  /** Default continuation. null/undefined = next step in the list. "__end__" ends the flow. */
  next_step_id?: string | null;
};

export const END_STEP = "__end__";

export const STEP_LABEL: Record<FlowStepKind, string> = {
  message: "Mensaje",
  question: "Pregunta",
  delay: "Espera",
  tag: "Etiquetar",
  save_lead: "Guardar lead",
  handoff: "Pasar a humano",
};

/** Variables offered by default in the editor; any custom name also works. */
export const COMMON_VARIABLES = ["name", "email", "phone", "budget", "service", "city"];

export function newStepId(): string {
  return `s_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultStep(kind: FlowStepKind): FlowStep {
  const base = { id: newStepId(), kind } as FlowStep;
  switch (kind) {
    case "message":
      return { ...base, actions: [{ kind: "text", body: "" }] };
    case "question":
      return {
        ...base,
        prompt: "",
        reply_mode: "buttons",
        choices: [
          { id: newStepId(), label: "" },
          { id: newStepId(), label: "" },
        ],
        input_type: "text",
        variable: "",
        conditions: [],
      };
    case "delay":
      return { ...base, delay_seconds: 60 };
    case "tag":
      return { ...base, tags: [] };
    case "save_lead":
      return base;
    case "handoff":
      return { ...base, reason: "El flujo derivó la conversación al equipo" };
  }
}

/** Renders {{variable}} placeholders using captured answers. */
export function interpolate(text: string, vars: Record<string, unknown>): string {
  return (text ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars?.[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
