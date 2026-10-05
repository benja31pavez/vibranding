/**
 * Plantillas de mensajes de seguimiento (español de Chile, cordiales y breves).
 *
 * Reglas de redacción: sin promesas de resultados ni garantías, sin presión,
 * siempre con salida fácil ("si no es buen momento, me dices") y con la firma
 * de Benjamín. El texto se copia o se abre en WhatsApp; nunca se envía solo.
 */
import type { FollowupKind, TemplateData } from "./types";

export const SIGNATURE = "Benjamín · Vibranding";

const greeting = (name: string) => `Hola, equipo de ${name}.`;

/** Agrega " (detalle)" solo si hay detalle. */
const opt = (value: string | null, render: (v: string) => string) => (value ? render(value) : "");

const linkLine = (link: string | null, label: string) => (link ? `\n\n${label}: ${link}` : "");

type Builder = (d: TemplateData) => string;

const BUILDERS: Readonly<Record<FollowupKind, Builder>> = {
  propuesta_no_vista: (d) =>
    `${greeting(d.businessName)} Les escribo para contarles que les envié la propuesta` +
    `${opt(d.offerName, (v) => ` "${v}"`)}${opt(d.amountLabel, (v) => ` por ${v}`)}. ` +
    `Quizás se perdió entre otros mensajes, así que se las dejo de nuevo por aquí.` +
    linkLine(d.link, "Propuesta") +
    `\n\nCualquier duda la vemos sin problema.`,

  propuesta_sin_respuesta: (d) =>
    `${greeting(d.businessName)} Vi que pudieron revisar la propuesta` +
    `${opt(d.offerName, (v) => ` "${v}"`)}. ¿Les quedó alguna duda o hay algo que les gustaría ajustar? ` +
    `Lo conversamos cuando les acomode; y si no es buen momento, me dicen nomás.` +
    linkLine(d.link, "Propuesta"),

  propuesta_por_vencer: (d) =>
    `${greeting(d.businessName)} Les cuento que la propuesta` +
    `${opt(d.offerName, (v) => ` "${v}"`)}${opt(d.amountLabel, (v) => ` (${v})`)} ` +
    `está vigente${opt(d.dateLabel, (v) => ` hasta el ${v}`)}. Si quieren avanzar, la pueden aceptar desde el mismo link; ` +
    `y si necesitan más tiempo, me avisan y la revisamos.` +
    linkLine(d.link, "Propuesta"),

  prospecto_sin_respuesta: (d) =>
    `${greeting(d.businessName)} Les escribí hace unos días por el tema de su presencia digital` +
    `${opt(d.offerName, (v) => ` (${v})`)}. Si les interesa, coordinamos una conversación corta; ` +
    `si no es prioridad ahora, no hay problema, me dicen y no insisto.`,

  prospecto_sin_avance: (d) =>
    `${greeting(d.businessName)} ¿Cómo están? Quería retomar lo que conversamos` +
    `${opt(d.offerName, (v) => ` sobre ${v}`)}. ¿Les acomoda que les prepare una propuesta o ` +
    `prefieren que veamos primero alguna duda?`,

  cobro_vencido: (d) =>
    `${greeting(d.businessName)} Les escribo por el pago` +
    `${opt(d.offerName, (v) => ` de ${v}`)}${opt(d.amountLabel, (v) => ` por ${v}`)}` +
    `${opt(d.dateLabel, (v) => `, que venció el ${v}`)}. Si ya lo hicieron, disculpen el mensaje y me avisan para revisarlo.` +
    linkLine(d.link, "Link de pago"),

  cobro_por_vencer: (d) =>
    `${greeting(d.businessName)} Les dejo un recordatorio del pago` +
    `${opt(d.offerName, (v) => ` de ${v}`)}${opt(d.amountLabel, (v) => ` por ${v}`)}` +
    `${opt(d.dateLabel, (v) => `, que vence el ${v}`)}.` +
    linkLine(d.link, "Link de pago") +
    `\n\nCualquier cosa me escriben.`,

  onboarding_pendiente: (d) =>
    `${greeting(d.businessName)} Para partir con ${d.offerName ?? "el trabajo"} necesito algunos datos de su negocio ` +
    `(marca, contacto y accesos). Son unos minutos en este formulario:` +
    (d.link ? `\n\n${d.link}` : "") +
    `\n\nSi les complica algo, me dicen y lo vemos juntos.`,

  reporte_sin_enviar: (d) =>
    `${greeting(d.businessName)} Ya está listo el reporte${opt(d.periodLabel, (v) => ` de ${v}`)} ` +
    `con lo que hicimos y cómo se movieron sus redes.` +
    linkLine(d.link, "Reporte") +
    `\n\nSi quieren lo revisamos juntos en una llamada corta.`,
};

/** Mensaje final listo para copiar, con firma. */
export function buildMessage(data: TemplateData): string {
  return `${BUILDERS[data.kind](data)}\n\n${SIGNATURE}`;
}
