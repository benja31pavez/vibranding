/**
 * Textos comerciales de la propuesta pública (/p/$token), por plan.
 *
 * Reglas de copy (no cambiar sin hablar con Benja):
 *  - Nunca prometer resultados específicos (ventas, seguidores, consultas).
 *  - Sin garantías de devolución de dinero.
 *  - El chatbot de WhatsApp es un adicional pagado: nunca aparece como incluido.
 *  - Montos siempre en CLP con `formatMoney` (aquí no hay montos).
 */
import { translations } from "@/i18n/translations";
import { planNotIncluded as planNotIncludedFromPlans, type PlanKey } from "@/lib/pricing/plans";

export const TIMELINE_NOTE =
  "Calendario referencial: los plazos dependen de que tengamos tu información y aprobaciones a tiempo.";

export interface WeekStep {
  readonly week: string;
  readonly title: string;
  readonly items: readonly string[];
}

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

/** Resultado que busca cada plan, en lenguaje del cliente (sin cifras prometidas). */
const OUTCOME: Readonly<Record<PlanKey, string>> = {
  "marca-web":
    "Una marca profesional y una web lista para que tus clientes te escriban por WhatsApp.",
  contenido:
    "Redes activas y profesionales todo el mes, sin que tengas que preocuparte de qué publicar.",
  crecimiento:
    "Contenido constante y campañas en Meta y Google para que más personas te encuentren y te escriban.",
  mantencion:
    "Tus redes siguen activas y ordenadas cada mes, con el método que ya conoces de trabajar con nosotros.",
};

const GENERIC_OUTCOME = "Todo lo que acordamos, por escrito, con precios claros en pesos chilenos.";

export function proposalOutcome(planKey: PlanKey | null): string {
  return planKey ? OUTCOME[planKey] : GENERIC_OUTCOME;
}

/**
 * Plan Mantención: solo para ex clientes, no está en la home (por eso su lista
 * vive aquí y no en translations).
 */
const MANTENCION_FEATURES: readonly string[] = [
  "8 piezas al mes (posts, carruseles o historias)",
  "Calendario mensual de contenido",
  "Aprobación de cada pieza en tu portal de cliente",
  "Reporte mensual",
];

/** Lo que incluye el plan: misma lista que la home (una sola fuente). */
export function planFeatures(planKey: PlanKey | null): readonly string[] {
  if (!planKey) return [];
  if (planKey === "mantencion") return MANTENCION_FEATURES;
  return translations.es.home.plans.items.find((p) => p.id === planKey)?.features ?? [];
}

/** Lo que el plan no incluye: misma lista que la home y las páginas de servicio. */
export function planNotIncluded(planKey: PlanKey | null): readonly string[] {
  return planNotIncludedFromPlans(planKey);
}

const KICKOFF: WeekStep = {
  week: "Semana 1",
  title: "Partimos",
  items: [
    "Reunión de inicio por videollamada (30–45 min).",
    "Nos compartes la información de tu negocio y los accesos necesarios.",
  ],
};

const FIRST_30_DAYS: Readonly<Record<PlanKey, readonly WeekStep[]>> = {
  "marca-web": [
    {
      ...KICKOFF,
      items: [
        ...KICKOFF.items,
        "Nuestro equipo arma la primera versión del kit de marca y de la landing con tu información.",
      ],
    },
    {
      week: "Semana 2",
      title: "Ajustamos y publicamos",
      items: [
        "Revisas y nos pides los ajustes que necesites.",
        "Publicamos la landing con botón de WhatsApp y formulario.",
        "Dejamos optimizada tu ficha de Google Business.",
      ],
    },
    {
      week: "Semana 3",
      title: "Revisamos que todo funcione",
      items: [
        "Probamos formularios, botón de WhatsApp y vista en celular.",
        "Te entregamos los archivos de tu marca para usarlos donde quieras.",
      ],
    },
    {
      week: "Semana 4",
      title: "Cierre y próximos pasos",
      items: [
        "Resolvemos dudas sobre cómo usar tu marca y tu web.",
        "Si quieres seguir creciendo, te recomendamos el siguiente paso (sin compromiso).",
      ],
    },
  ],
  contenido: [
    {
      ...KICKOFF,
      items: [
        ...KICKOFF.items,
        "Revisamos tu perfil actual y definimos la línea gráfica y el tono.",
      ],
    },
    {
      week: "Semana 2",
      title: "Calendario y primeras piezas",
      items: [
        "Te enviamos el calendario del mes con los textos.",
        "Primeras piezas (posts, carruseles y reels) para tu aprobación.",
      ],
    },
    {
      week: "Semana 3",
      title: "Publicamos",
      items: [
        "Publicamos lo que apruebas, según el calendario.",
        "Publicaciones en tu ficha de Google Business.",
      ],
    },
    {
      week: "Semana 4",
      title: "Medimos y planificamos",
      items: [
        "Reporte mensual con lo que funcionó y lo que vamos a ajustar.",
        "Planificamos el contenido del mes 2 con lo aprendido.",
      ],
    },
  ],
  crecimiento: [
    {
      ...KICKOFF,
      items: [
        ...KICKOFF.items,
        "Configuramos la medición: conversaciones de WhatsApp y formularios.",
      ],
    },
    {
      week: "Semana 2",
      title: "Calendario y anuncios",
      items: [
        "Calendario de contenido del mes con los textos.",
        "Creatividades y segmentación de las campañas para tu aprobación.",
      ],
    },
    {
      week: "Semana 3",
      title: "Lanzamos",
      items: [
        "Activamos las campañas en Meta Ads y Google Ads (la pauta la pagas directo a cada plataforma).",
        "Publicamos el contenido aprobado.",
      ],
    },
    {
      week: "Semana 4",
      title: "Optimizamos y reportamos",
      items: [
        "Primeras optimizaciones según los datos reales de las campañas.",
        "Reporte mensual y plan del mes 2.",
      ],
    },
  ],
  mantencion: [
    {
      ...KICKOFF,
      items: [
        "Breve reunión para retomar: qué cambió en tu negocio desde que trabajamos juntos.",
        "Revisamos tus accesos y la línea gráfica que ya tienes.",
      ],
    },
    {
      week: "Semana 2",
      title: "Calendario y piezas",
      items: [
        "Te enviamos el calendario del mes con las 8 piezas.",
        "Apruebas cada pieza en tu portal antes de publicarla.",
      ],
    },
    {
      week: "Semana 3",
      title: "Publicamos",
      items: ["Publicamos lo que apruebas, según el calendario."],
    },
    {
      week: "Semana 4",
      title: "Reporte",
      items: ["Reporte mensual con lo publicado y cómo le fue.", "Planificamos el mes siguiente."],
    },
  ],
};

const GENERIC_30_DAYS: readonly WeekStep[] = [
  KICKOFF,
  {
    week: "Semanas 2 y 3",
    title: "Producimos",
    items: ["Trabajamos en lo acordado y te mostramos avances para tu aprobación."],
  },
  {
    week: "Semana 4",
    title: "Entregamos y revisamos",
    items: ["Revisamos juntos lo entregado y definimos los próximos pasos."],
  },
];

export function first30Days(planKey: PlanKey | null): readonly WeekStep[] {
  return planKey ? FIRST_30_DAYS[planKey] : GENERIC_30_DAYS;
}

export const PROCESS_STEPS: readonly { title: string; desc: string }[] = [
  { title: "Aceptas en línea", desc: "Toma menos de 2 minutos, aquí mismo." },
  {
    title: "Pagas el primer cobro",
    desc: "Con link de pago o transferencia. Recibes factura o boleta.",
  },
  { title: "Reunión de inicio", desc: "Te contactamos para agendarla y pedirte lo necesario." },
  { title: "Producimos, apruebas, publicamos", desc: "Nada sale sin tu visto bueno." },
];

export function proposalFaq(
  planKey: PlanKey | null,
  hasMonthly: boolean,
  minMonths: number,
): readonly FaqItem[] {
  const faq: FaqItem[] = [];
  if (hasMonthly) {
    faq.push({
      q: "¿Hay permanencia mínima?",
      a: `Sí, ${minMonths} meses: es el tiempo que se necesita para construir y medir de verdad. Después sigue mes a mes y puedes cancelar avisando con 30 días de anticipación.`,
    });
  }
  if (planKey === "mantencion") {
    faq.push({
      q: "¿Incluye anuncios o campañas?",
      a: "No. El Plan Mantención es solo contenido orgánico. Si más adelante quieres campañas, te proponemos el Plan Crecimiento.",
    });
  }
  if (planKey === "crecimiento") {
    faq.push({
      q: "¿La inversión en anuncios está incluida?",
      a: "No. La pauta la pagas directo a Meta y Google con tu propio medio de pago, así siempre ves en qué se gasta. Nosotros creamos, administramos y optimizamos las campañas.",
    });
  }
  faq.push(
    {
      q: "¿Cómo pago?",
      a: "Después de aceptar puedes pagar con link de pago o por transferencia. Los precios están en pesos chilenos y son netos, más IVA (19%); el total a pagar que ves en la propuesta ya incluye el IVA. Recibes factura o boleta.",
    },
    {
      q: "¿Qué necesitan de mí?",
      a: "Información de tu negocio, los accesos a tus cuentas y tu aprobación antes de publicar. Te guiamos paso a paso en la reunión de inicio.",
    },
    {
      q: "¿Me aseguran un número de ventas o seguidores?",
      a: "No prometemos cifras específicas, porque dependen de factores fuera de nuestro control (tu rubro, competencia, precios, temporada). Sí nos comprometemos a trabajar con método, medir y mostrarte cada mes qué estamos haciendo y por qué.",
    },
    {
      q: "¿Incluye chatbot de WhatsApp?",
      a: "No viene incluido en los planes. Es un servicio adicional con costo aparte; si te interesa, lo sumamos a la propuesta.",
    },
  );
  return faq;
}
