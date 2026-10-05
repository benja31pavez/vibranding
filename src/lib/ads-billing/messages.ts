/**
 * Mensaje al cliente cuando Meta reporta un problema con el pago de la pauta.
 * Nunca se envía solo: el dueño lo copia o lo abre en WhatsApp/correo.
 */
import { metaBillingHubUrl, type MetaBillingReason } from "./metaStatus";

export interface AdsBillingMessageInput {
  clientName: string;
  contactName?: string | null;
  reason: MetaBillingReason;
  adAccountId?: string | null;
}

const PROBLEM: Partial<Record<MetaBillingReason, { what: string; todo: string }>> = {
  unsettled: {
    what: "tiene un saldo pendiente: Meta no pudo cobrar la publicidad a tu tarjeta",
    todo: "paga el saldo pendiente o cambia la tarjeta en Configuración de pagos",
  },
  disabled: {
    what: "aparece deshabilitada",
    todo: "revisa el aviso que muestra Meta y confirma que tu tarjeta esté vigente",
  },
  no_funding: {
    what: "no tiene una tarjeta registrada",
    todo: "toca Agregar método de pago y registra tu tarjeta",
  },
};

const FALLBACK = {
  what: "tiene un problema con el medio de pago",
  todo: "revisa que tu tarjeta esté vigente y sin saldos pendientes",
};

export function buildAdsBillingMessage(input: AdsBillingMessageInput): {
  subject: string;
  body: string;
} {
  const p = PROBLEM[input.reason] ?? FALLBACK;
  const greeting = input.contactName?.trim() ? `Hola ${input.contactName.trim()}` : "Hola";
  const body = [
    `${greeting}, te escribo de Vibranding.`,
    "",
    `Revisamos la cuenta publicitaria de Meta de ${input.clientName} y ${p.what}. Mientras no se resuelva, los anuncios pueden quedar detenidos.`,
    "",
    "Para solucionarlo:",
    `1. Entra a ${metaBillingHubUrl(input.adAccountId ?? null)}`,
    "2. Elige la cuenta publicitaria de tu negocio.",
    `3. En Configuración de pagos, ${p.todo}.`,
    "",
    "Recuerda que la tarjeta está a tu nombre y Meta te cobra directamente la publicidad; Vibranding nunca cobra la pauta.",
    "",
    "Si quieres, lo vemos juntos por videollamada. ¡Gracias!",
  ].join("\n");
  return { subject: `Pago de publicidad en Meta · ${input.clientName}`, body };
}
