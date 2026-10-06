import type { HealthReasonCode } from "@/lib/health";

/** Título corto de cada señal de salud (la línea gris es el motivo con cifras). */
export const SIGNAL_TITLE: Readonly<Record<HealthReasonCode, string>> = {
  cobro_vencido: "Cobro vencido",
  aprobacion_estancada: "Aprobación pendiente",
  cambios_sin_resolver: "Cambios sin resolver",
  alerta_campana: "Alerta de campaña",
  reporte_sin_enviar: "Reporte sin enviar",
  sin_respuesta_cliente: "Sin respuesta",
  renovacion_cercana: "Renovación próxima",
  onboarding_incompleto: "Onboarding incompleto",
};

const MESSAGE_BODY: Readonly<Record<HealthReasonCode | "general", string>> = {
  cobro_vencido:
    "te escribo por el cobro pendiente de este mes. ¿Te reenvío el link de pago para dejarlo al día?",
  aprobacion_estancada:
    "tienes piezas esperando tu aprobación en el portal. ¿Las revisamos juntos en 15 minutos?",
  cambios_sin_resolver:
    "ya tenemos tus comentarios y estamos aplicando los cambios. Te aviso apenas estén listos.",
  alerta_campana:
    "estamos revisando tus campañas para ajustar lo necesario. Te cuento apenas esté listo.",
  reporte_sin_enviar:
    "estamos cerrando tu reporte del mes. ¿Te parece si lo revisamos juntos esta semana?",
  sin_respuesta_cliente:
    "¿cómo va todo? Queremos proponerte el contenido de las próximas semanas. ¿Tienes 15 minutos esta semana?",
  renovacion_cercana:
    "se acerca el cierre de tu periodo con nosotros. ¿Agendamos una reunión para revisar resultados y próximos pasos?",
  onboarding_incompleto:
    "te reenvío el formulario de onboarding para avanzar. Si quieres, lo completamos juntos por videollamada.",
  general: "¿cómo va todo? Cualquier cosa que necesites, aquí estamos.",
};

/** Mensaje sugerido según la señal principal (o uno general si está todo bien). */
export function suggestedMessage(
  code: HealthReasonCode | null | undefined,
  contactName: string | null,
): string {
  const firstName = contactName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hola ${firstName}, ` : "Hola, ";
  return `${greeting}${MESSAGE_BODY[code ?? "general"]}`;
}
