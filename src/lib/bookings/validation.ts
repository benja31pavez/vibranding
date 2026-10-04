import type { z } from "zod";

const FIELD_LABELS: Record<string, string> = {
  slug: "La agenda",
  scheduledAt: "El horario",
  from: "La fecha de inicio",
  to: "La fecha de término",
  name: "El nombre",
  email: "El email",
  phone: "El teléfono",
  notes: "Las notas",
};

function issueMessage(issue: z.ZodIssue): string {
  const field = String(issue.path[0] ?? "");
  const label = FIELD_LABELS[field] ?? "Un dato";
  if (field === "email" && issue.code === "invalid_string") return "Ingresa un email válido.";
  if (field === "scheduledAt" || field === "from" || field === "to") return `${label} no es válido.`;
  switch (issue.code) {
    case "too_small":
      return `${label} es obligatorio.`;
    case "too_big":
      return `${label} es demasiado largo.`;
    case "invalid_type":
      return issue.received === "undefined" ? `${label} es obligatorio.` : `${label} no es válido.`;
    default:
      return `${label} no es válido.`;
  }
}

/** Parses with a Zod schema and throws an Error with a readable Spanish message. */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  throw new Error(first ? issueMessage(first) : "Datos inválidos.");
}
