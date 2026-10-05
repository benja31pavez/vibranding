/**
 * Plantillas por rubro para armar la landing del plan "Marca + Web" en minutos.
 * Precargan textos en español de Chile, servicios con íconos, preguntas frecuentes
 * y el orden de secciones típico del rubro. No inventan testimonios: esos se
 * piden al cliente real.
 */
import type { FaqItem, LandingSectionKey, LandingTemplate } from "@/lib/landingTheme";

export type RubroKey = "hogar" | "salud" | "estetica" | "pasteleria";

type ServiceSeed = { title: string; description: string; icon: string };

export type RubroTemplate = {
  key: RubroKey;
  label: string;
  examples: string;
  theme_color: string;
  template: LandingTemplate;
  dark_mode: boolean;
  hero_subtitle: string;
  cta_text: string;
  whatsapp_cta_text: string;
  whatsapp_message: string;
  services: ServiceSeed[];
  faq: FaqItem[];
  section_order: LandingSectionKey[];
  /** Qué secciones opcionales quedan activas. */
  enable: {
    whatsapp: boolean;
    testimonios: boolean;
    ubicacion: boolean;
    faq: boolean;
    contacto: boolean;
  };
  seo_description: (name: string) => string;
};

export const RUBRO_TEMPLATES: RubroTemplate[] = [
  {
    key: "hogar",
    label: "Servicios del hogar",
    examples: "Paisajismo, gasfitería, electricidad, limpieza, mudanzas",
    theme_color: "#15803d",
    template: "classic",
    dark_mode: false,
    hero_subtitle:
      "Trabajos a domicilio con presupuesto sin costo, materiales de calidad y trabajo prolijo. Atendemos casas, departamentos y condominios.",
    cta_text: "Cotizar gratis",
    whatsapp_cta_text: "Cotiza por WhatsApp",
    whatsapp_message: "Hola, vi su página y quiero cotizar un trabajo en mi casa.",
    services: [
      {
        title: "Visita y presupuesto",
        description:
          "Vamos a tu domicilio, evaluamos el trabajo y te enviamos el presupuesto el mismo día.",
        icon: "home",
      },
      {
        title: "Mantención mensual",
        description: "Planes de mantención para casas y condominios, con visitas programadas.",
        icon: "wrench",
      },
      {
        title: "Proyectos a medida",
        description: "Diseñamos y ejecutamos el proyecto completo, de principio a fin.",
        icon: "leaf",
      },
    ],
    faq: [
      {
        question: "¿En qué comunas atienden?",
        answer:
          "Atendemos las comunas indicadas más abajo. Si tu comuna no aparece, escríbenos y lo revisamos.",
      },
      {
        question: "¿La visita tiene costo?",
        answer: "La visita para cotizar no tiene costo dentro de nuestra zona de cobertura.",
      },
      {
        question: "¿Cómo se paga?",
        answer:
          "Aceptamos transferencia, débito y crédito. Para proyectos grandes trabajamos con abono inicial.",
      },
      {
        question: "¿Entregan boleta o factura?",
        answer: "Sí, emitimos boleta o factura según lo necesites.",
      },
    ],
    section_order: [
      "servicios",
      "galeria",
      "whatsapp",
      "ubicacion",
      "testimonios",
      "faq",
      "contacto",
    ],
    enable: { whatsapp: true, testimonios: false, ubicacion: true, faq: true, contacto: true },
    seo_description: (n) =>
      `${n}: servicios a domicilio con presupuesto sin costo. Cotiza por WhatsApp.`,
  },
  {
    key: "salud",
    label: "Salud y profesionales",
    examples: "Kinesiología, psicología, nutrición, dentistas, abogados",
    theme_color: "#0e7490",
    template: "centered",
    dark_mode: false,
    hero_subtitle:
      "Atención profesional, cercana y puntual. Agenda tu hora presencial u online y recibe confirmación por WhatsApp.",
    cta_text: "Agendar hora",
    whatsapp_cta_text: "Agenda por WhatsApp",
    whatsapp_message: "Hola, quiero agendar una hora. ¿Qué horarios tienen disponibles?",
    services: [
      {
        title: "Primera consulta",
        description: "Evaluación inicial para entender tu caso y proponer un plan de tratamiento.",
        icon: "stethoscope",
      },
      {
        title: "Sesiones de seguimiento",
        description: "Controles periódicos para medir avances y ajustar el plan.",
        icon: "clock",
      },
      {
        title: "Atención online",
        description: "Sesiones por videollamada desde cualquier lugar de Chile.",
        icon: "laptop",
      },
    ],
    faq: [
      {
        question: "¿Atienden con Fonasa o Isapre?",
        answer:
          "Entregamos boleta para que solicites el reembolso en tu Isapre o seguro complementario.",
      },
      {
        question: "¿Cuánto dura cada sesión?",
        answer: "Cada sesión dura aproximadamente 45 a 60 minutos.",
      },
      {
        question: "¿Puedo cambiar mi hora?",
        answer: "Sí, avísanos con al menos 24 horas de anticipación por WhatsApp.",
      },
    ],
    section_order: [
      "servicios",
      "testimonios",
      "ubicacion",
      "faq",
      "whatsapp",
      "galeria",
      "contacto",
    ],
    enable: { whatsapp: true, testimonios: false, ubicacion: true, faq: true, contacto: true },
    seo_description: (n) =>
      `${n}: atención profesional presencial y online. Agenda tu hora por WhatsApp.`,
  },
  {
    key: "estetica",
    label: "Gimnasio y estética",
    examples: "Gimnasios, centros de estética, peluquerías, uñas, spa",
    theme_color: "#be185d",
    template: "fullbleed",
    dark_mode: true,
    hero_subtitle:
      "Resultados que se notan, con profesionales certificados y un ambiente donde te sientes cómodo. Reserva tu primera clase o tratamiento.",
    cta_text: "Reservar ahora",
    whatsapp_cta_text: "Reserva por WhatsApp",
    whatsapp_message: "Hola, quiero reservar. ¿Tienen horas disponibles esta semana?",
    services: [
      {
        title: "Clase o sesión de prueba",
        description: "Conoce el lugar y al equipo antes de decidirte.",
        icon: "sparkles",
      },
      {
        title: "Planes mensuales",
        description: "Planes flexibles para que vengas cuando te acomode.",
        icon: "dumbbell",
      },
      {
        title: "Tratamientos personalizados",
        description: "Evaluamos tu caso y te recomendamos lo que realmente necesitas.",
        icon: "heart",
      },
    ],
    faq: [
      {
        question: "¿Necesito reservar?",
        answer: "Sí, trabajamos con reserva para darte la atención que mereces.",
      },
      { question: "¿Qué medios de pago aceptan?", answer: "Débito, crédito y transferencia." },
      {
        question: "¿Tienen estacionamiento?",
        answer: "Revisa la sección de ubicación o escríbenos y te indicamos cómo llegar.",
      },
    ],
    section_order: [
      "servicios",
      "galeria",
      "testimonios",
      "whatsapp",
      "ubicacion",
      "faq",
      "contacto",
    ],
    enable: { whatsapp: true, testimonios: false, ubicacion: true, faq: true, contacto: false },
    seo_description: (n) =>
      `${n}: reserva tu hora por WhatsApp. Profesionales certificados y planes flexibles.`,
  },
  {
    key: "pasteleria",
    label: "Pastelería y comida",
    examples: "Pastelerías, tortas, banquetería, cafeterías, comida a domicilio",
    theme_color: "#b45309",
    template: "classic",
    dark_mode: false,
    hero_subtitle:
      "Tortas, postres y cóctel hechos a mano con ingredientes frescos. Pedidos con anticipación y despacho a domicilio.",
    cta_text: "Hacer un pedido",
    whatsapp_cta_text: "Pide por WhatsApp",
    whatsapp_message: "Hola, quiero hacer un pedido. ¿Me pueden enviar el catálogo y precios?",
    services: [
      {
        title: "Tortas personalizadas",
        description:
          "Para cumpleaños, matrimonios y celebraciones. Tú eliges sabor, tamaño y diseño.",
        icon: "gift",
      },
      {
        title: "Cóctel y banquetería",
        description: "Bocados dulces y salados para eventos y oficinas.",
        icon: "utensils",
      },
      {
        title: "Despacho a domicilio",
        description: "Entregamos en las comunas de nuestra zona de cobertura.",
        icon: "truck",
      },
    ],
    faq: [
      {
        question: "¿Con cuánta anticipación debo pedir?",
        answer:
          "Recomendamos pedir con al menos 48 horas de anticipación; para eventos, una semana.",
      },
      {
        question: "¿Hacen despacho?",
        answer: "Sí, despachamos en las comunas indicadas. El costo depende de la comuna.",
      },
      {
        question: "¿Tienen opciones sin gluten o sin azúcar?",
        answer: "Sí, consúltanos por WhatsApp las opciones disponibles.",
      },
    ],
    section_order: [
      "galeria",
      "servicios",
      "whatsapp",
      "testimonios",
      "ubicacion",
      "faq",
      "contacto",
    ],
    enable: { whatsapp: true, testimonios: false, ubicacion: true, faq: true, contacto: false },
    seo_description: (n) =>
      `${n}: tortas y postres hechos a mano con despacho a domicilio. Pide por WhatsApp.`,
  },
];

export function rubroTemplate(key: RubroKey): RubroTemplate {
  return RUBRO_TEMPLATES.find((t) => t.key === key) ?? RUBRO_TEMPLATES[0];
}
