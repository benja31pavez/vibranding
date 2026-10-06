/**
 * Contenido de las páginas de servicio (SEO local). Edita aquí los textos:
 * cada entrada genera una página pública en `path`.
 *
 * Reglas del contenido: no prometer resultados, no inventar cifras, clientes
 * ni testimonios. Los precios salen de `src/lib/pricing/plans.ts`.
 */
import { CHATBOT_ADDON, LANDING_ADDON, type AddonKey } from "@/lib/pricing/addons";
import { findPlan, type PublicPlanKey } from "@/lib/pricing/plans";
import { formatClp } from "@/lib/site";

/** Precio NETO de un plan formateado con "+ IVA" (`${MARCA_WEB_PRICE}` = "$149.990 + IVA"), leído de plans.ts. */
function planPrice(key: PublicPlanKey): string {
  const plan = findPlan(key);
  if (!plan) throw new Error(`Plan desconocido en content.ts: ${key}`);
  return `${formatClp(plan.netPrice)} + IVA`;
}

const MARCA_WEB_PRICE = planPrice("marca-web");
const CONTENIDO_PRICE = planPrice("contenido");
const CRECIMIENTO_PRICE = planPrice("crecimiento");

export type ServiceSlug =
  | "pagina-web-para-pymes"
  | "agencia-marketing-digital-santiago"
  | "publicidad-meta-ads"
  | "google-ads-pymes"
  | "chatbot-whatsapp";

export interface ServiceStep {
  readonly title: string;
  readonly desc: string;
}

export interface ServiceFaq {
  readonly q: string;
  readonly a: string;
}

/** Precio de la página: planes fijos de plans.ts o un adicional de precio fijo (addons.ts). */
export type ServicePricing =
  | { readonly kind: "plans"; readonly planKeys: readonly PublicPlanKey[]; readonly note: string }
  | { readonly kind: "addon"; readonly addonKey: AddonKey; readonly note: string };

const LANDING_PRICE = `${formatClp(LANDING_ADDON.setupNet)} + IVA`;
const CHATBOT_SETUP = `${formatClp(CHATBOT_ADDON.setupNet)} + IVA`;
const CHATBOT_MONTHLY = `${formatClp(CHATBOT_ADDON.monthlyNet)} + IVA`;

export interface ServiceContent {
  readonly slug: ServiceSlug;
  readonly path: `/${ServiceSlug}`;
  /** Texto corto para enlaces (footer, servicios relacionados). */
  readonly navLabel: string;
  /** <title> único (≈ 60 caracteres). */
  readonly title: string;
  /** Meta description única (≈ 150 caracteres). */
  readonly description: string;
  /** Nombre del servicio para JSON-LD y migas de pan. */
  readonly serviceName: string;
  readonly serviceType: string;
  readonly eyebrow: string;
  readonly h1Lead: string;
  readonly h1Accent: string;
  readonly intro: string;
  readonly problem: { readonly title: string; readonly points: readonly string[] };
  readonly solution: {
    readonly title: string;
    readonly body: string;
    readonly points: readonly string[];
  };
  readonly includes: readonly string[];
  readonly pricing: ServicePricing;
  readonly steps: readonly ServiceStep[];
  readonly faqs: readonly ServiceFaq[];
  readonly whatsappMessage: string;
  /** Plan sugerido al ir a /diagnostico (precarga el formulario). */
  readonly diagnosticoPlan?: PublicPlanKey;
  readonly related: readonly ServiceSlug[];
}

/** Resumen de cada plan para las tarjetas de precio (el precio sale de plans.ts). */
export const PLAN_SUMMARY: Readonly<Record<PublicPlanKey, string>> = {
  "marca-web":
    "Kit de marca básico, landing con WhatsApp y formulario, y ficha de Google Business optimizada.",
  contenido:
    "12 piezas al mes para tus redes, calendario y copy, 4 publicaciones en Google Business y reporte mensual.",
  crecimiento:
    "Todo el Plan Contenido más campañas de Meta Ads y Google Ads con optimización continua y reporte.",
};

const AD_SPEND_NOTE =
  "Para la pauta sugerimos partir desde $150.000 al mes, pagados directo a Meta o Google con tu tarjeta, y ajustarla según los reportes.";

export const SERVICES: Readonly<Record<ServiceSlug, ServiceContent>> = {
  "pagina-web-para-pymes": {
    slug: "pagina-web-para-pymes",
    path: "/pagina-web-para-pymes",
    navLabel: "Página web para pymes",
    title: `Página web para pymes en Chile desde ${MARCA_WEB_PRICE} | Vibranding`,
    description: `Página web para tu pyme con marca, botón de WhatsApp, formulario y ficha de Google optimizada. ${MARCA_WEB_PRICE}, pago único. Santiago y regiones.`,
    serviceName: "Página web para pymes",
    serviceType: "Diseño de página web",
    eyebrow: "Marca + Web · pago único",
    h1Lead: "Página web para pymes que",
    h1Accent: "te trae conversaciones",
    intro:
      "Una página clara, en español y pensada para el celular, que explica lo que haces y lleva a tus clientes a escribirte por WhatsApp. Incluye tu kit de marca básico y tu ficha de Google Business optimizada.",
    problem: {
      title: "¿Te pasa esto?",
      points: [
        "Tu negocio funciona por recomendación, pero cuando alguien te busca en Google no encuentra nada serio.",
        "Te piden tu página web y solo tienes un Instagram o un PDF.",
        "Cotizaste webs y no entiendes qué incluyen, cuánto cuestan al final ni cuánto se demoran.",
        "Tienes una web antigua que no se ve bien en el celular y nadie te escribe desde ahí.",
      ],
    },
    solution: {
      title: "Una web simple que hace una sola cosa bien",
      body: "No necesitas un sitio de 20 secciones para partir. Armamos una landing que responde lo que tu cliente pregunta antes de comprar (qué haces, dónde, cuánto, por qué tú) y lo lleva directo a WhatsApp o a un formulario.",
      points: [
        "Precio cerrado y alcance por escrito antes de empezar",
        "Diseño mobile-first: la mayoría de tus clientes te verá desde el celular",
        "Textos escritos para tu rubro y tu comuna, no plantillas genéricas",
      ],
    },
    includes: [
      "Kit de marca básico: logo, colores y tipografías",
      "Landing en español con botón de WhatsApp y formulario de contacto",
      "Diseño adaptado a celular, tablet y computador",
      "Ficha de Google Business optimizada (categorías, servicios, horarios y fotos)",
      "Títulos y descripciones básicas para que Google entienda tu página",
      "Entrega en 2 a 3 semanas, con revisiones contigo",
    ],
    pricing: {
      kind: "plans",
      planKeys: ["marca-web"],
      note: `¿Necesitas otra página para una campaña o servicio? Cada landing extra cuesta ${LANDING_PRICE} (pago único). Otras funciones (tienda, pagos) se conversan aparte antes de empezar.`,
    },
    steps: [
      {
        title: "Diagnóstico gratis",
        desc: "Nos cuentas de tu negocio y revisamos cómo te ve hoy un cliente en internet.",
      },
      {
        title: "Propuesta y pago",
        desc: "Te enviamos alcance y plazo por escrito. Pagas por transferencia o link de pago, con factura o boleta.",
      },
      {
        title: "Diseño y textos",
        desc: "Armamos tu marca y tu landing con tu información y fotos. Revisas y pides ajustes.",
      },
      {
        title: "Publicación",
        desc: "Publicamos la web, conectamos WhatsApp y dejamos tu ficha de Google al día.",
      },
    ],
    faqs: [
      {
        q: "¿Cuánto cuesta una página web para una pyme en Chile?",
        a: `Depende del alcance. Nuestro plan Marca + Web cuesta ${MARCA_WEB_PRICE} (pago único) e incluye kit de marca básico, landing con WhatsApp y formulario, y ficha de Google Business optimizada. Cada landing extra cuesta ${LANDING_PRICE} (pago único).`,
      },
      {
        q: "¿En cuánto tiempo está lista?",
        a: "Entre 2 y 3 semanas desde que tenemos tu información (textos base, fotos y datos de contacto). Te mostramos avances en el camino y ajustamos contigo antes de publicar.",
      },
      {
        q: "¿La página aparece en Google?",
        a: "La dejamos preparada para que Google la pueda leer (títulos, descripciones y estructura) y optimizamos tu ficha de Google Business. El lugar en que apareces depende de muchos factores, así que no prometemos posiciones.",
      },
      {
        q: "¿Puedo vender online con esta página?",
        a: "Este plan es una landing para recibir contactos por WhatsApp y formulario, no una tienda online. Si necesitas carrito y pagos, cuéntanos en el diagnóstico y lo cotizamos por separado.",
      },
      {
        q: "¿Qué necesito tener para empezar?",
        a: "Una descripción de lo que vendes, tu zona de atención, tu número de WhatsApp y algunas fotos de tu trabajo. Si no tienes logo, lo hacemos dentro del kit de marca.",
      },
    ],
    whatsappMessage:
      "Hola Vibranding, quiero una página web para mi pyme (plan Marca + Web). Mi negocio es: ",
    diagnosticoPlan: "marca-web",
    related: ["agencia-marketing-digital-santiago", "google-ads-pymes", "chatbot-whatsapp"],
  },

  "agencia-marketing-digital-santiago": {
    slug: "agencia-marketing-digital-santiago",
    path: "/agencia-marketing-digital-santiago",
    navLabel: "Agencia de marketing digital en Santiago",
    title: "Agencia de marketing digital en Santiago para pymes | Vibranding",
    description: `Agencia de marketing digital en Santiago para pymes: marca, contenido para redes, Meta Ads y Google Ads. Planes desde ${CONTENIDO_PRICE}/mes, precios claros.`,
    serviceName: "Agencia de marketing digital para pymes",
    serviceType: "Marketing digital",
    eyebrow: "Agencia en Santiago · pymes de todo Chile",
    h1Lead: "Agencia de marketing digital en Santiago",
    h1Accent: "para pymes",
    intro:
      "Somos VIBRANDING SpA, una agencia chica de Santiago que trabaja con pymes: marca, contenido para Instagram y Facebook, ficha de Google y campañas en Meta Ads y Google Ads, con planes de precio fijo en pesos.",
    problem: {
      title: "Problemas comunes de las pymes",
      points: [
        "Contrataron a una agencia grande y terminaron hablando con alguien distinto cada mes.",
        "Pagan un fee, pero no saben bien qué se hizo ni qué resultados tuvo.",
        "Publican cuando se acuerdan y las redes no reflejan lo bueno que es su negocio.",
        "No saben si les conviene más Instagram, Google o una web.",
      ],
    },
    solution: {
      title: "Planes claros y una persona a cargo",
      body: "Trabajamos con tres planes de precio fijo, con alcance por escrito y un reporte mensual que explica qué hicimos y qué vamos a ajustar. Usamos herramientas de IA para producir más rápido, pero cada pieza la revisa una persona antes de publicarse.",
      points: [
        "Precios netos en pesos chilenos + IVA, sin costos escondidos",
        "Contenido pensado para tu rubro y tu zona de Santiago o región",
        "Tú apruebas lo que se publica",
      ],
    },
    includes: [
      "Diagnóstico gratis de tu marca, tus redes y tu presencia en Google",
      "Kit de marca y landing con WhatsApp (plan Marca + Web)",
      "12 piezas al mes: posts, carruseles y reels, con calendario y copy (Plan Contenido)",
      "4 publicaciones al mes en tu ficha de Google Business",
      "Campañas de Meta Ads y Google Ads con optimización continua (Plan Crecimiento)",
      "Reporte mensual en lenguaje simple",
    ],
    pricing: {
      kind: "plans",
      planKeys: ["marca-web", "contenido", "crecimiento"],
      note: "Los planes mensuales no tienen permanencia: cada pago cubre un mes. " + AD_SPEND_NOTE,
    },
    steps: [
      {
        title: "Conversamos",
        desc: "Haces el diagnóstico gratis o nos escribes por WhatsApp y nos cuentas de tu negocio.",
      },
      {
        title: "Te recomendamos un plan",
        desc: "Te decimos qué plan tiene sentido para ti, o si por ahora no te conviene ninguno.",
      },
      {
        title: "Producimos",
        desc: "Armamos calendario, piezas y campañas. Revisas y apruebas antes de publicar.",
      },
      {
        title: "Medimos y ajustamos",
        desc: "Cada mes recibes un reporte con lo que funcionó, lo que no y lo que cambiaremos.",
      },
    ],
    faqs: [
      {
        q: "¿Cuánto cobra una agencia de marketing digital en Santiago?",
        a: `Varía mucho entre agencias. En Vibranding los planes mensuales parten en ${CONTENIDO_PRICE}/mes (Plan Contenido) y el Plan Crecimiento, con anuncios, cuesta ${CRECIMIENTO_PRICE}/mes, sin permanencia. Marca + Web es un pago único de ${MARCA_WEB_PRICE}.`,
      },
      {
        q: "¿Atienden solo en Santiago?",
        a: "Estamos en Santiago, pero el trabajo es online, así que atendemos pymes de cualquier región de Chile. No trabajamos con clientes fuera de Chile.",
      },
      {
        q: "¿Hay permanencia mínima?",
        a: "No. Cada pago de un plan mensual cubre un mes de servicio y no hay cobros automáticos: para seguir, renuevas al terminar el mes. Marca + Web es un pago único. No hay devoluciones.",
      },
      {
        q: "¿Garantizan resultados?",
        a: "No. Nadie puede garantizar ventas o seguidores sin mentir. Lo que sí hacemos es trabajar con un plan claro, medir cada mes y explicarte qué estamos ajustando y por qué.",
      },
      {
        q: "¿Con qué tipo de negocios trabajan?",
        a: "Trabajamos con pymes y emprendimientos de cualquier rubro. El diagnóstico gratis nos sirve para conocer tu negocio y proponerte por dónde partir.",
      },
    ],
    whatsappMessage:
      "Hola Vibranding, busco una agencia de marketing digital para mi pyme. Mi negocio es: ",
    related: ["pagina-web-para-pymes", "publicidad-meta-ads", "google-ads-pymes"],
  },

  "publicidad-meta-ads": {
    slug: "publicidad-meta-ads",
    path: "/publicidad-meta-ads",
    navLabel: "Publicidad en Instagram y Facebook",
    title: "Publicidad en Instagram y Facebook (Meta Ads) para pymes | Vibranding",
    description: `Campañas de Meta Ads en Instagram y Facebook para pymes chilenas, con contenido y optimización mensual. Plan Crecimiento ${CRECIMIENTO_PRICE}/mes, pauta aparte.`,
    serviceName: "Publicidad en Instagram y Facebook (Meta Ads)",
    serviceType: "Gestión de campañas de Meta Ads",
    eyebrow: "Meta Ads · Instagram y Facebook",
    h1Lead: "Publicidad en Instagram y Facebook",
    h1Accent: "para tu negocio",
    intro:
      "Creamos y administramos tus campañas de Meta Ads para que personas de tu zona vean tu negocio en Instagram y Facebook y te escriban por WhatsApp. Las medimos y ajustamos cada mes.",
    problem: {
      title: "Por qué el botón Promocionar no alcanza",
      points: [
        "Promocionaste un post desde la app, se gastó la plata y no llegó ningún mensaje.",
        "No sabes a quién le están mostrando tus anuncios ni cuánto te cuesta cada contacto.",
        "Tus anuncios son el mismo post de siempre y no se distinguen en el feed.",
        "Nadie revisa las campañas después de lanzarlas.",
      ],
    },
    solution: {
      title: "Campañas armadas con un objetivo y revisadas cada mes",
      body: "Definimos qué quieres conseguir (mensajes por WhatsApp, formularios o visitas), a quién mostrarle tus anuncios y con qué piezas. Después revisamos los números y movemos presupuesto hacia lo que funciona mejor.",
      points: [
        "Segmentación por zona, intereses y comportamiento",
        "Piezas pensadas como anuncio, no solo posts promocionados",
        "La cuenta publicitaria es tuya y la pauta la pagas directo a Meta",
      ],
    },
    includes: [
      "Configuración o revisión de tu cuenta publicitaria y del píxel",
      "Campañas en Instagram y Facebook orientadas a mensajes o formularios",
      "Diseño de anuncios: imágenes, carruseles y reels",
      "Monitoreo y optimización continua del presupuesto",
      "Todo el Plan Contenido: 12 piezas al mes para tus redes",
      "Reporte mensual con lo que se invirtió y lo que se obtuvo",
    ],
    pricing: {
      kind: "plans",
      planKeys: ["crecimiento"],
      note: "Sin permanencia: cada pago cubre un mes. " + AD_SPEND_NOTE,
    },
    steps: [
      {
        title: "Diagnóstico",
        desc: "Revisamos tus redes, tu oferta y si ya hiciste anuncios antes.",
      },
      {
        title: "Estrategia",
        desc: "Definimos objetivo, público, presupuesto de pauta y piezas del primer mes.",
      },
      {
        title: "Lanzamiento",
        desc: "Apruebas los anuncios y los publicamos desde tu cuenta publicitaria.",
      },
      {
        title: "Optimización",
        desc: "Revisamos resultados, pausamos lo que no funciona y te enviamos el reporte mensual.",
      },
    ],
    faqs: [
      {
        q: "¿Cuánto cuesta hacer publicidad en Instagram?",
        a: `Hay dos costos: la gestión y la pauta. La gestión está dentro del Plan Crecimiento (${CRECIMIENTO_PRICE}/mes, que también incluye contenido y Google Ads). La pauta la pagas directo a Meta; sugerimos partir desde $150.000 al mes.`,
      },
      {
        q: "¿Cuánto debería invertir en pauta al mes?",
        a: "Depende de tu rubro, tu zona y tu objetivo. Para una pyme que parte sugerimos desde $150.000 al mes, y lo ajustamos según lo que muestren los reportes. Tú decides el monto.",
      },
      {
        q: "¿Cuándo veo resultados?",
        a: "Las primeras semanas sirven para aprender qué público y qué anuncios responden mejor. Por eso recomendamos darle al menos un par de meses. No prometemos un número de clientes, pero sí un reporte claro de lo que pasa con tu inversión.",
      },
      {
        q: "¿Las campañas quedan a mi nombre?",
        a: "Sí. La cuenta publicitaria y el medio de pago son tuyos; nosotros trabajamos con acceso de administrador. Si terminas el plan, todo queda contigo.",
      },
      {
        q: "¿Pueden hacer solo los anuncios, sin contenido?",
        a: "Nuestro plan con anuncios incluye contenido, porque las campañas funcionan mejor con un perfil activo. Si tu caso es distinto, cuéntanos en el diagnóstico.",
      },
    ],
    whatsappMessage:
      "Hola Vibranding, quiero hacer publicidad en Instagram y Facebook (Meta Ads). Mi negocio es: ",
    diagnosticoPlan: "crecimiento",
    related: ["google-ads-pymes", "agencia-marketing-digital-santiago", "chatbot-whatsapp"],
  },

  "google-ads-pymes": {
    slug: "google-ads-pymes",
    path: "/google-ads-pymes",
    navLabel: "Google Ads para pymes",
    title: "Google Ads para pymes en Chile | Vibranding",
    description: `Campañas de Google Ads para pymes chilenas: aparece cuando te buscan en tu comuna. Plan Crecimiento ${CRECIMIENTO_PRICE}/mes, con Meta Ads y contenido. Pauta aparte.`,
    serviceName: "Google Ads para pymes",
    serviceType: "Gestión de campañas de Google Ads",
    eyebrow: "Google Ads · búsqueda local",
    h1Lead: "Google Ads para pymes:",
    h1Accent: "aparece cuando te buscan",
    intro:
      "Cuando alguien escribe en Google lo que vendes y tu comuna, ya está buscando contratar. Creamos y administramos campañas de búsqueda para que tu negocio aparezca en ese momento y te contacten.",
    problem: {
      title: "Lo que suele pasar",
      points: [
        "Tu competencia aparece arriba en Google y tú no.",
        "Probaste Google Ads solo y se gastó el presupuesto en búsquedas que no tenían nada que ver.",
        "No sabes qué palabras clave usar ni cuánto pagar por clic.",
        "Los anuncios llevan a una página que no invita a escribir.",
      ],
    },
    solution: {
      title: "Campañas de búsqueda enfocadas en tu zona",
      body: "Elegimos las búsquedas que hace un cliente con intención de contratar, excluimos las que solo gastan plata y llevamos el clic a una página o a WhatsApp. Revisamos términos de búsqueda y presupuesto cada mes.",
      points: [
        "Palabras clave por servicio y por comuna o región",
        "Lista de palabras negativas para no pagar clics inútiles",
        "Seguimiento de llamadas, WhatsApp y formularios cuando es posible",
      ],
    },
    includes: [
      "Investigación de palabras clave para tu rubro y tu zona",
      "Creación o revisión de tu cuenta de Google Ads",
      "Anuncios de búsqueda con textos y extensiones",
      "Configuración de conversiones (formularios, llamadas o WhatsApp)",
      "Optimización continua: términos de búsqueda, pujas y presupuesto",
      "También incluye Meta Ads, contenido mensual y reporte (Plan Crecimiento)",
    ],
    pricing: {
      kind: "plans",
      planKeys: ["crecimiento"],
      note: "Sin permanencia: cada pago cubre un mes. " + AD_SPEND_NOTE,
    },
    steps: [
      {
        title: "Diagnóstico",
        desc: "Vemos qué buscan tus clientes, quién aparece hoy y a dónde llevaría el anuncio.",
      },
      {
        title: "Estructura",
        desc: "Armamos campañas por servicio y zona, con palabras clave y negativas.",
      },
      {
        title: "Lanzamiento",
        desc: "Apruebas anuncios y presupuesto, y activamos las campañas en tu cuenta.",
      },
      {
        title: "Optimización",
        desc: "Revisamos términos de búsqueda y costos cada mes, y te enviamos el reporte.",
      },
    ],
    faqs: [
      {
        q: "¿Cuánto cuesta Google Ads para una pyme en Chile?",
        a: `Google cobra por clic y no tiene un mínimo fijo; tú defines el presupuesto. La gestión está dentro del Plan Crecimiento (${CRECIMIENTO_PRICE}/mes). Para la pauta sugerimos partir desde $150.000 al mes entre Google y Meta, y ajustarla con los reportes.`,
      },
      {
        q: "¿Es mejor Google Ads o Instagram?",
        a: "Sirven para cosas distintas: Google captura a quien ya está buscando tu servicio; Instagram y Facebook te muestran a personas que todavía no te buscan. Por eso el Plan Crecimiento incluye ambos y movemos el presupuesto según lo que funcione en tu caso.",
      },
      {
        q: "¿Necesito una página web para hacer Google Ads?",
        a: "Ayuda mucho tener una página clara a la que llegue el anuncio. Si no tienes, puedes partir con el plan Marca + Web. En algunos casos también se puede llevar el clic directo a una llamada.",
      },
      {
        q: "¿Google Ads es lo mismo que salir en Google Maps?",
        a: "No. Google Maps muestra tu ficha de Google Business, que optimizamos sin costo de pauta. Google Ads son anuncios pagados que aparecen arriba de los resultados. Se complementan.",
      },
      {
        q: "¿En cuánto tiempo aparezco en Google con anuncios?",
        a: "Una vez aprobados por Google, los anuncios pueden empezar a mostrarse en poco tiempo. Que te hagan clic y te contacten depende de la competencia, el presupuesto y tu oferta, por eso medimos y ajustamos cada mes.",
      },
    ],
    whatsappMessage:
      "Hola Vibranding, quiero hacer campañas de Google Ads para mi pyme. Mi negocio es: ",
    diagnosticoPlan: "crecimiento",
    related: ["publicidad-meta-ads", "pagina-web-para-pymes", "agencia-marketing-digital-santiago"],
  },

  "chatbot-whatsapp": {
    slug: "chatbot-whatsapp",
    path: "/chatbot-whatsapp",
    navLabel: "Chatbot de WhatsApp",
    title: "Chatbot de WhatsApp para negocios en Chile | Vibranding",
    description: `Chatbot de WhatsApp para tu negocio: responde preguntas frecuentes, horarios y precios, y te pasa los contactos. ${CHATBOT_SETUP} y ${CHATBOT_MONTHLY}/mes.`,
    serviceName: "Chatbot de WhatsApp para negocios",
    serviceType: "Chatbot de WhatsApp",
    eyebrow: "Servicio adicional · precio fijo",
    h1Lead: "Chatbot de WhatsApp para",
    h1Accent: "responder sin estar pegado al celular",
    intro:
      "Un asistente en tu WhatsApp que responde las preguntas que te hacen todos los días (precios, horarios, ubicación, cómo agendar) y te deja el contacto listo para que tú cierres la venta.",
    problem: {
      title: "Si atiendes tu WhatsApp tú mismo",
      points: [
        "Respondes las mismas preguntas varias veces al día.",
        "Te escriben de noche o en fin de semana y contestas tarde.",
        "Se te pierden conversaciones entre mensajes personales y de clientes.",
        "No sabes cuántas personas te escribieron por tus anuncios.",
      ],
    },
    solution: {
      title: "Respuestas inmediatas para lo repetitivo, tú para lo importante",
      body: "Armamos un flujo con las preguntas frecuentes de tu negocio y las respuestas que tú apruebas. Cuando la conversación necesita una persona (una cotización especial, un reclamo), el chatbot te la pasa.",
      points: [
        "Respuestas escritas con el tono de tu marca",
        "Derivación a una persona cuando hace falta",
        "Se complementa con tus anuncios de Meta Ads y Google Ads",
      ],
    },
    includes: [
      "Levantamiento de las preguntas frecuentes de tus clientes",
      "Diseño del flujo de conversación y de los textos",
      "Respuestas para precios, horarios, ubicación, servicios y agendamiento",
      "Derivación a una persona del equipo",
      "Pruebas antes de activarlo y ajustes durante el primer mes",
    ],
    pricing: {
      kind: "addon",
      addonKey: "chatbot",
      note: "Se contrata junto a un plan mensual. La configuración se paga una vez y la mensualidad se paga junto con cada mes de tu plan mientras el chatbot esté activo. Sin permanencia: puedes darlo de baja cuando quieras.",
    },
    steps: [
      {
        title: "Diagnóstico",
        desc: "Nos cuentas qué te preguntan tus clientes y cómo atiendes hoy tu WhatsApp.",
      },
      {
        title: "Contratación",
        desc: "Lo contratas desde tu panel, junto a tu plan mensual, a precio fijo.",
      },
      {
        title: "Flujo y textos",
        desc: "Escribimos las respuestas y el flujo; tú las revisas y apruebas.",
      },
      {
        title: "Activación",
        desc: "Lo probamos contigo, lo activamos y lo ajustamos con las conversaciones reales.",
      },
    ],
    faqs: [
      {
        q: "¿Cuánto cuesta un chatbot de WhatsApp?",
        a: `${CHATBOT_SETUP} de configuración (pago único) y ${CHATBOT_MONTHLY} al mes, que se paga junto con cada mes de tu plan. Precio fijo, sin cotizaciones a medida.`,
      },
      {
        q: "¿Necesito WhatsApp Business?",
        a: "En el diagnóstico revisamos cómo atiendes hoy y te explicamos qué se necesita para conectar el chatbot a tu número antes de contratar, para que no haya sorpresas.",
      },
      {
        q: "¿El chatbot reemplaza a una persona?",
        a: "No. Responde lo repetitivo y ordena los contactos; las conversaciones que necesitan criterio (una cotización especial, un reclamo) se derivan a ti o a tu equipo.",
      },
      {
        q: "¿Puedo cambiar las respuestas después?",
        a: "Sí. Durante el primer mes ajustamos las respuestas con las conversaciones reales, y después puedes pedirnos cambios cuando cambien tus precios o servicios.",
      },
      {
        q: "¿Lo puedo contratar sin un plan mensual?",
        a: "No. Es un servicio adicional que se contrata con un plan mensual vigente (Contenido o Crecimiento); su mensualidad se paga junto con cada mes del plan.",
      },
    ],
    whatsappMessage:
      "Hola Vibranding, me interesa el chatbot de WhatsApp para mi negocio. Mi negocio es: ",
    related: ["publicidad-meta-ads", "pagina-web-para-pymes", "agencia-marketing-digital-santiago"],
  },
};

/** Orden en el que se listan los servicios (footer, sitemap, llms.txt). */
export const SERVICE_ORDER: readonly ServiceSlug[] = [
  "pagina-web-para-pymes",
  "agencia-marketing-digital-santiago",
  "publicidad-meta-ads",
  "google-ads-pymes",
  "chatbot-whatsapp",
];

export const SERVICE_LIST: readonly ServiceContent[] = SERVICE_ORDER.map((slug) => SERVICES[slug]);
