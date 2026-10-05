/**
 * Lógica pura del resultado del formulario /diagnostico (sin dependencias de
 * servidor, para poder probarla en scripts/check-diagnostico-outcome.mjs).
 */
import type { DiagnosticoResult } from "./diagnostico.schema";

export type SaveOutcome = "created" | "noted" | "no_org" | "error";

/** Tag estable para buscar en los logs del Worker los leads que no se guardaron. */
export const LEAD_LOST_TAG = "[diagnostico][LEAD_PERDIDO]";

/** Solo created/noted dejan el lead en la plataforma; el resto muestra el fallback de WhatsApp. */
export function resultForOutcome(outcome: SaveOutcome): DiagnosticoResult {
  return outcome === "created" || outcome === "noted" ? { ok: true } : { ok: false, reason: "not_saved" };
}

/** Línea de log sin PII: paso, código y un prefijo del hash del correo (nunca el correo). */
export function leadLostLine(ctx: { outcome: SaveOutcome; step: string; code?: string; emailHash?: string | null }): string {
  const parts = [
    LEAD_LOST_TAG,
    `outcome=${ctx.outcome}`,
    `step=${ctx.step}`,
    `code=${ctx.code ?? "?"}`,
    ctx.emailHash ? `email_hash=${ctx.emailHash.slice(0, 12)}` : null,
  ];
  return parts.filter(Boolean).join(" ");
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const SNIPPET_MAX = 200;

/** Fragmento corto de un mensaje de error externo, con correos ocultos. */
export function safeSnippet(raw: string): string {
  return raw.replace(EMAIL_RE, "[email]").replace(/\s+/g, " ").trim().slice(0, SNIPPET_MAX);
}
