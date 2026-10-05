import type { PublicPlanKey } from "@/lib/pricing/plans";
export type Lang = "es" | "en";

type LegalBlock =
  | { type: "p"; html: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type LegalContent = {
  title: string;
  updated: string;
  intro?: string;
  blocks: LegalBlock[];
};

export type PlanItem = {
  id: PublicPlanKey;
  name: string;
  /** Precio NETO en CLP (se suma IVA). Debe coincidir con plans.ts: lo revisa `npm run check:iva`. */
  price: number;
  period: string;
  terms: string;
  desc: string;
  features: string[];
  whatsappMessage: string;
  highlighted: boolean;
};

const homeEs = {
  nav: {
    services: "Servicios",
    plans: "Planes",
    how: "Cómo trabajamos",
    faq: "Preguntas",
    clientAccess: "Acceso clientes",
    cta: "Pide tu diagnóstico gratis",
    ctaShort: "Diagnóstico gratis",
  },
  hero: {
    badge: "Agencia en Santiago · Pymes de todo Chile",
    titleLead: "Marketing digital para pymes chilenas que quieren",
    titleAccent: "más clientes",
    subtitle:
      "Te apoyamos con la imagen visual de tu marca, la planificación de tu contenido, campañas en Meta Ads y Google Ads y un embudo de ventas, para que más personas te encuentren y te escriban por WhatsApp.",
    priceLine: "Planes desde $129.990 + IVA/mes.",
    ctaPrimary: "Cotiza por WhatsApp",
    ctaSecondary: "Ver planes",
    trust: ["Precios claros en pesos", "Factura o boleta"],
  },
  niches: {
    title: "Algunos rubros con los que trabajamos",
    items: [
      {
        title: "Servicios y oficios del hogar",
        desc: "Paisajismo, piscinas, remodelación y mantención.",
      },
      {
        title: "Salud y profesionales",
        desc: "Consultas, centros de salud y servicios profesionales.",
      },
      {
        title: "Gimnasios y estética",
        desc: "Gimnasios, estudios, centros de estética y belleza.",
      },
    ],
  },
  benefits: {
    title: "Tres pilares para",
    titleAccent: "que tu negocio venda",
    items: [
      {
        title: "Te encuentran",
        desc: "Ficha de Google Business optimizada, una web clara y anuncios que te ponen frente a quien ya está buscando lo que vendes.",
      },
      {
        title: "Te eligen",
        desc: "Una marca cuidada y contenido constante generan confianza. El cliente compara y se queda con quien se ve profesional.",
      },
      {
        title: "Te compran",
        desc: "Cada pieza lleva a un solo lugar: tu WhatsApp o tu formulario. Menos clics, más conversaciones con clientes reales.",
      },
    ],
  },
  services: {
    title: "Lo que",
    titleAccent: "hacemos por ti",
    subtitle:
      "Todo lo que una pyme necesita para vender en internet, con un solo equipo y un solo contacto.",
    items: [
      {
        title: "Branding",
        desc: "Logo, colores, tipografías y tono de tu marca para que te vean profesional en todos lados.",
      },
      {
        title: "Contenido",
        desc: "Posts, carruseles y reels con calendario y textos listos. Tú apruebas y publicas.",
      },
      {
        title: "Meta Ads",
        desc: "Campañas en Instagram y Facebook segmentadas por comuna, intereses y edad, con optimización continua.",
      },
      {
        title: "Google Ads",
        desc: "Aparece cuando alguien busca tu servicio en Google. Medimos cada consulta y ajustamos la inversión.",
      },
    ],
    extras:
      "Además: landing pages con botón de WhatsApp y formulario, y chatbot de WhatsApp para responder las preguntas frecuentes de tus clientes.",
  },
  plans: {
    title: "Planes y",
    titleAccent: "precios",
    subtitle: "Precios netos en pesos chilenos, más IVA. Sin costos escondidos.",
    popular: "Más completo",
    cta: "Lo quiero",
    adSpendNote:
      "Para la pauta sugerimos partir desde $150.000 al mes, pagados directo a Meta y Google con tu tarjeta.",
    items: [
      {
        id: "marca-web",
        name: "Marca + Web",
        price: 149990,
        period: "pago único",
        terms: "Entrega en 72 horas hábiles",
        desc: "Para partir con una presencia profesional desde cero.",
        features: [
          "Kit de marca básico (logo, colores y tipografías)",
          "Landing en español con botón de WhatsApp y formulario",
          "Ficha de Google Business optimizada",
        ],
        whatsappMessage:
          "Hola Vibranding, me interesa el plan Marca + Web ($149.990 + IVA). Mi negocio es: ",
        highlighted: false,
      },
      {
        id: "contenido",
        name: "Plan Contenido",
        price: 129990,
        period: "al mes",
        terms: "Mínimo 3 meses",
        desc: "Para mantener tus redes activas y profesionales todo el mes.",
        features: [
          "12 piezas al mes: posts, carruseles y reels",
          "Calendario de contenido y copy",
          "4 publicaciones al mes en Google Business",
          "Reporte mensual",
        ],
        whatsappMessage:
          "Hola Vibranding, me interesa el Plan Contenido ($129.990 + IVA/mes). Mi negocio es: ",
        highlighted: false,
      },
      {
        id: "crecimiento",
        name: "Plan Crecimiento",
        price: 249990,
        period: "al mes",
        terms: "Mínimo 3 meses",
        desc: "Para conseguir clientes nuevos con anuncios, además del contenido.",
        features: [
          "Todo lo del Plan Contenido",
          "Campañas de Meta Ads (Instagram y Facebook)",
          "Campañas de Google Ads",
          "Monitoreo y optimización continua de tus campañas",
          "Reporte mensual de resultados",
        ],
        whatsappMessage:
          "Hola Vibranding, me interesa el Plan Crecimiento ($249.990 + IVA/mes). Mi negocio es: ",
        highlighted: true,
      },
    ] as PlanItem[],
  },
  how: {
    title: "Cómo",
    titleAccent: "trabajamos",
    steps: [
      {
        title: "Conversamos",
        desc: "Nos escribes por WhatsApp, nos cuentas de tu negocio y te recomendamos el plan que tiene sentido para ti.",
      },
      {
        title: "Propuesta y pago",
        desc: "Te enviamos alcance y plazos por escrito. Pagas por transferencia o link de pago y recibes factura o boleta.",
      },
      {
        title: "Producimos y optimizamos",
        desc: "Entregamos en días, publicamos lo que apruebas, medimos y ajustamos cada mes con un reporte claro.",
      },
    ],
  },
  portfolio: {
    title: "Marcas con las que",
    titleAccent: "hemos trabajado",
    subtitle: "Proyectos de branding, contenido y campañas.",
    empty: "Muy pronto compartiremos nuestros casos.",
  },
  faq: {
    title: "Preguntas",
    titleAccent: "frecuentes",
    more: "Ver todas las preguntas",
  },
  finalCta: {
    title: "¿Hablamos de",
    titleAccent: "tu negocio",
    titleEnd: "?",
    subtitle:
      "Escríbenos por WhatsApp, cuéntanos qué vendes y dónde, y te decimos qué plan te conviene.",
    cta: "Cotiza por WhatsApp",
    bullets: ["Diagnóstico sin compromiso", "Respuesta en horario hábil"],
  },
  floatLabel: "Escríbenos por WhatsApp",
};

type HomeDict = typeof homeEs;

type Dict = {
  langSwitcher: { label: string; es: string; en: string };
  home: HomeDict;
  footer: {
    tagline: string;
    columns: { product: string; resources: string; legal: string };
    links: {
      services: string;
      how: string;
      clients: string;
      contact: string;
      plans: string;
      clientAccess: string;
      faq: string;
      terms: string;
      privacy: string;
      cookies: string;
    };
    rights: string;
    location: string;
  };
  legal: {
    back: string;
    updatedLabel: string;
  };
  faq: {
    title: string;
    updated: string;
    items: { q: string; a: string }[];
  };
  terms: LegalContent;
  privacy: LegalContent;
  cookies: LegalContent;
  dataDeletion: LegalContent;
  notFound: { title: string; subtitle: string; cta: string };
  error: { title: string; cta: string };
  seo: {
    home: { title: string; description: string };
    faq: { title: string; description: string };
    terms: { title: string; description: string };
    privacy: { title: string; description: string };
    cookies: { title: string; description: string };
    dataDeletion: { title: string; description: string };
  };
};

const es: Dict = {
  langSwitcher: { label: "Idioma", es: "ES", en: "EN" },
  home: homeEs,
  footer: {
    tagline:
      "Agencia de marketing digital para pymes en Chile: branding, contenido, Meta Ads y Google Ads.",
    columns: { product: "Agencia", resources: "Recursos", legal: "Legal" },
    links: {
      services: "Servicios",
      how: "Cómo trabajamos",
      clients: "Clientes",
      contact: "Cotiza por WhatsApp",
      plans: "Planes y precios",
      clientAccess: "Acceso clientes",
      faq: "Preguntas Frecuentes",
      terms: "Términos de Servicio",
      privacy: "Política de Privacidad",
      cookies: "Cookies",
    },
    rights: "Todos los derechos reservados.",
    location: "Santiago, Chile",
  },
  legal: { back: "Volver al inicio", updatedLabel: "Última actualización:" },
  faq: {
    title: "Preguntas Frecuentes",
    updated: "5 de octubre de 2026",
    items: [
      {
        q: "¿Hay permanencia mínima?",
        a: "Marca + Web es un pago único. Los planes Contenido y Crecimiento tienen un mínimo de 3 meses, porque es el tiempo razonable para ver cómo responde tu público. Después siguen mes a mes y puedes cancelar avisando con 30 días de anticipación.",
      },
      {
        q: "¿La pauta publicitaria está incluida?",
        a: "No. En el Plan Crecimiento nuestro precio cubre la creación, gestión y optimización de las campañas. La inversión en anuncios (pauta) la pagas directo a Meta y Google con tu tarjeta, así siempre sabes cuánto se gasta. Sugerimos partir desde $150.000 al mes.",
      },
      {
        q: "¿Cuánto se demoran?",
        a: "Marca + Web se entrega en 72 horas hábiles desde que recibimos tu información y el pago. En los planes mensuales te enviamos el calendario de contenido durante la primera semana, y las campañas parten apenas apruebas los anuncios.",
      },
      {
        q: "¿Con qué tipo de negocios trabajan?",
        a: "Con pymes, emprendimientos y profesionales de todo Chile, de cualquier rubro: servicios, comercio, salud, gimnasios, estética, gastronomía y más. Si tienes dudas, escríbenos y te decimos con honestidad cómo te podemos ayudar.",
      },
      {
        q: "¿Cómo se paga?",
        a: "Por transferencia bancaria o link de pago, en pesos chilenos. Los precios publicados son netos y se les suma IVA (19%). Emitimos factura o boleta de VIBRANDING SpA (RUT 78.505.344-3). Los planes mensuales se pagan por mes adelantado.",
      },
      {
        q: "¿Usan inteligencia artificial?",
        a: "Sí. Somos un equipo apoyado en IA para producir, analizar y optimizar más rápido; por eso entregamos en días y no en semanas. Cada pieza la revisa una persona antes de llegar a ti, y nada se publica sin tu aprobación.",
      },
    ],
  },
  terms: {
    title: "Términos de Servicio",
    updated: "5 de octubre de 2026",
    intro:
      "Estos términos regulan los servicios que presta VIBRANDING SpA, RUT 78.505.344-3, con domicilio en Santiago de Chile (en adelante, “Vibranding”). Al contratar nuestros servicios o usar esta plataforma aceptas lo siguiente.",
    blocks: [
      { type: "h2", text: "1. Servicios" },
      {
        type: "p",
        html: "Vibranding presta servicios de marketing digital a empresas y profesionales en Chile: branding, creación de contenido, optimización de presencia digital (incluida la ficha de Google Business), landing pages y gestión de campañas de Meta Ads y Google Ads. El alcance específico de cada servicio se acuerda por escrito antes de comenzar.",
      },
      { type: "h2", text: "2. Precios y pagos" },
      {
        type: "p",
        html: "Los precios se expresan en pesos chilenos (CLP) y son netos: a cada precio se le suma el IVA (19%). El pago se realiza por transferencia bancaria o link de pago, y VIBRANDING SpA emite la factura o boleta correspondiente. Los planes mensuales se pagan por mes adelantado. La mora superior a 15 días puede causar la suspensión del servicio.",
      },
      { type: "h2", text: "3. Inversión publicitaria" },
      {
        type: "p",
        html: "La inversión en anuncios (pauta) no está incluida en nuestros precios. El cliente la paga directamente a Meta, Google u otras plataformas, con su propio medio de pago.",
      },
      { type: "h2", text: "4. Permanencia y cancelación" },
      {
        type: "p",
        html: "Los planes mensuales tienen una permanencia mínima de 3 meses. Cumplido ese plazo continúan mes a mes y pueden cancelarse avisando con 30 días de anticipación. Los servicios de pago único no son reembolsables una vez iniciados, sin perjuicio de los derechos que la ley otorgue al cliente.",
      },
      { type: "h2", text: "5. Resultados" },
      {
        type: "p",
        html: "Aplicamos buenas prácticas de la industria y optimizamos las campañas de forma continua, pero no garantizamos resultados específicos de alcance, seguidores, consultas o ventas, ya que dependen de factores fuera de nuestro control.",
      },
      { type: "h2", text: "6. Propiedad intelectual" },
      {
        type: "p",
        html: "El material entregado pasa a ser propiedad del cliente una vez pagado en su totalidad. Vibranding puede mostrar el trabajo en su portafolio, salvo que el cliente solicite lo contrario por escrito.",
      },
      { type: "h2", text: "7. Confidencialidad" },
      {
        type: "p",
        html: "Tratamos toda la información compartida como confidencial y no la revelamos a terceros sin autorización.",
      },
      { type: "h2", text: "8. Limitación de responsabilidad" },
      {
        type: "p",
        html: "La responsabilidad máxima de Vibranding ante cualquier reclamo se limita al monto pagado por el cliente en los 3 meses anteriores al hecho que motiva el reclamo, en la medida que la ley lo permita.",
      },
      { type: "h2", text: "9. Modificaciones" },
      {
        type: "p",
        html: "Podemos actualizar estos términos. Las modificaciones aplican desde su publicación en este sitio.",
      },
      { type: "h2", text: "10. Ley aplicable y jurisdicción" },
      {
        type: "p",
        html: "Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales ordinarios de justicia de la ciudad de Santiago.",
      },
      { type: "h2", text: "11. Contacto" },
      {
        type: "p",
        html: 'VIBRANDING SpA · RUT 78.505.344-3 · Santiago, Chile. Para dudas o reclamos escríbenos por WhatsApp al +56 9 8929 4014 o a <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a>.',
      },
    ],
  },
  privacy: {
    title: "Política de Privacidad",
    updated: "5 de octubre de 2026",
    intro:
      "En Vibranding respetamos tu privacidad. El responsable del tratamiento de tus datos es VIBRANDING SpA, RUT 78.505.344-3, con domicilio en Santiago de Chile. Esta política explica qué datos recopilamos y cómo los usamos, conforme a la legislación chilena de protección de datos personales.",
    blocks: [
      { type: "h2", text: "1. Datos que recopilamos" },
      {
        type: "ul",
        items: [
          "Datos de contacto: nombre, email, teléfono, marca o empresa.",
          "Datos de cuenta: credenciales de acceso a la plataforma.",
          "Datos operativos: información de tus campañas y cuentas que tú nos compartes para ejecutar el servicio.",
          "Datos de uso: páginas visitadas, eventos, tipo de dispositivo.",
        ],
      },
      { type: "h2", text: "2. Para qué los usamos" },
      {
        type: "ul",
        items: [
          "Prestar y mejorar nuestros servicios.",
          "Comunicarnos contigo sobre tu proyecto.",
          "Cumplir obligaciones legales y contables.",
        ],
      },
      {
        type: "p",
        html: "Correos de novedades y consejos: solo te los enviamos si lo aceptas expresamente (por ejemplo, marcando la casilla opcional del formulario de diagnóstico, que viene desmarcada). Es voluntario y no afecta el diagnóstico ni ningún servicio. Puedes darte de baja cuando quieras, respondiendo a cualquiera de esos correos o escribiéndonos, y dejaremos de enviártelos. No compartimos tus datos con terceros para que te envíen su propia publicidad.",
      },
      { type: "h2", text: "3. Compartir con terceros" },
      {
        type: "p",
        html: "No vendemos tus datos. Solo los compartimos con proveedores que nos ayudan a operar (hosting, analítica, plataformas de publicidad), bajo acuerdos de confidencialidad.",
      },
      { type: "h2", text: "4. Seguridad" },
      {
        type: "p",
        html: "Aplicamos medidas técnicas y organizativas razonables para proteger tu información, incluyendo cifrado en tránsito y control de accesos.",
      },
      { type: "h2", text: "5. Tus derechos" },
      {
        type: "p",
        html: "Puedes acceder, corregir o eliminar tus datos en cualquier momento contactándonos por los canales indicados en el sitio.",
      },
      { type: "h2", text: "6. Conservación" },
      {
        type: "p",
        html: "Conservamos tus datos mientras dure la relación comercial y por el tiempo que la ley nos exija después.",
      },
      { type: "h2", text: "7. Cambios" },
      {
        type: "p",
        html: "Podemos actualizar esta política. Publicaremos los cambios en esta misma página.",
      },
    ],
  },
  cookies: {
    title: "Política de Cookies",
    updated: "13 de mayo de 2026",
    intro:
      "Este sitio usa cookies y tecnologías similares para que la plataforma funcione y para entender cómo se utiliza.",
    blocks: [
      { type: "h2", text: "¿Qué es una cookie?" },
      {
        type: "p",
        html: "Es un pequeño archivo que un sitio guarda en tu navegador para recordar información, como tu sesión o tus preferencias.",
      },
      { type: "h2", text: "Tipos de cookies que usamos" },
      {
        type: "ul",
        items: [
          "<strong>Esenciales:</strong> necesarias para iniciar sesión y mantener tu sesión activa.",
          "<strong>De preferencias:</strong> recuerdan opciones como cliente activo o vista preferida.",
          "<strong>De analítica:</strong> nos ayudan a medir el uso y mejorar la experiencia.",
        ],
      },
      { type: "h2", text: "Cookies de terceros" },
      {
        type: "p",
        html: "Si interactúas con elementos integrados de Meta o Google, esas plataformas pueden colocar sus propias cookies. Te recomendamos revisar sus políticas.",
      },
      { type: "h2", text: "Cómo controlarlas" },
      {
        type: "p",
        html: "Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que algunas funciones pueden dejar de operar correctamente si las desactivas.",
      },
      { type: "h2", text: "Contacto" },
      {
        type: "p",
        html: "Para dudas sobre esta política, contáctanos por los canales indicados en el sitio.",
      },
    ],
  },
  dataDeletion: {
    title: "Instrucciones para la eliminación de datos",
    updated: "17 de mayo de 2026",
    intro:
      "En Vibranding respetamos tu derecho a controlar tus datos personales. Si deseas que eliminemos toda la información asociada a tu cuenta —incluidos los datos obtenidos a través de la integración con Meta (Facebook e Instagram)— puedes solicitarlo siguiendo las instrucciones de esta página.",
    blocks: [
      { type: "h2", text: "1. Qué se eliminará" },
      {
        type: "ul",
        items: [
          "Tu cuenta de usuario y credenciales de acceso.",
          "Los datos de tu perfil y de los clientes que hayas creado.",
          "Tokens de acceso, identificadores y métricas obtenidas desde Meta (Facebook/Instagram).",
          "Cualquier contenido, objetivo o configuración almacenada en la plataforma.",
        ],
      },
      { type: "h2", text: "2. Cómo solicitar la eliminación" },
      { type: "p", html: "Tienes dos opciones:" },
      {
        type: "ul",
        items: [
          "<strong>Desde la app:</strong> inicia sesión, ve a los ajustes de tu cuenta y pulsa “Eliminar cuenta”. La eliminación se procesa de forma automática.",
          '<strong>Por email:</strong> envía un correo a <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a> desde la dirección asociada a tu cuenta, indicando “Solicitud de eliminación de datos” en el asunto.',
        ],
      },
      { type: "h2", text: "3. Plazo" },
      {
        type: "p",
        html: "Procesaremos tu solicitud en un plazo máximo de 30 días. Una vez completada, recibirás una confirmación por correo electrónico. Algunos datos pueden conservarse por obligaciones legales (facturación, prevención de fraude) durante el tiempo estrictamente necesario.",
      },
      { type: "h2", text: "4. Revocar permisos de Meta" },
      {
        type: "p",
        html: 'También puedes revocar el acceso de Vibranding a tu cuenta de Facebook o Instagram desde la configuración de tu cuenta de Meta, en <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer">Configuración → Apps y sitios web empresariales</a>. Esto detendrá el acceso de la app a tus datos, pero no elimina la información ya almacenada en Vibranding: para ello debes seguir los pasos anteriores.',
      },
      { type: "h2", text: "5. Contacto" },
      {
        type: "p",
        html: 'Para cualquier duda sobre el tratamiento de tus datos, escríbenos a <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a>.',
      },
    ],
  },
  notFound: { title: "404", subtitle: "Esta página no existe.", cta: "Volver al inicio" },
  error: { title: "Algo salió mal", cta: "Reintentar" },
  seo: {
    home: {
      title: "Agencia de marketing digital para pymes en Chile | Vibranding",
      description:
        "Branding, contenido, Meta Ads y Google Ads para pymes chilenas, con optimización continua. Planes desde $129.990 + IVA/mes. Cotiza por WhatsApp.",
    },
    faq: {
      title: "Preguntas Frecuentes | Vibranding",
      description:
        "Permanencia, pauta publicitaria, plazos, formas de pago y uso de IA: respuestas sobre los planes de marketing digital de Vibranding para pymes en Chile.",
    },
    terms: {
      title: "Términos de Servicio | Vibranding",
      description:
        "Términos y condiciones de los servicios de VIBRANDING SpA, agencia de marketing digital en Santiago de Chile.",
    },
    privacy: {
      title: "Política de Privacidad — Vibranding",
      description: "Cómo Vibranding recopila, usa y protege tus datos personales.",
    },
    cookies: {
      title: "Política de Cookies — Vibranding",
      description: "Qué cookies usa Vibranding y cómo puedes controlarlas.",
    },
    dataDeletion: {
      title: "Eliminación de datos — Vibranding",
      description: "Cómo solicitar la eliminación de tus datos personales en Vibranding.",
    },
  },
};

const en: Dict = {
  langSwitcher: { label: "Language", es: "ES", en: "EN" },
  // TODO: translate the home copy; the public site is Spanish-only for now.
  home: homeEs,
  footer: {
    tagline: "We grow your brand on Instagram and Meta Ads with strategy, design and data.",
    columns: { product: "Product", resources: "Resources", legal: "Legal" },
    links: {
      services: "Services",
      how: "How it works",
      clients: "Clients",
      contact: "Contact",
      plans: "Plans & pricing",
      clientAccess: "Client access",
      faq: "FAQ",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      cookies: "Cookies",
    },
    rights: "All rights reserved.",
    location: "Santiago, Chile",
  },
  legal: { back: "Back to home", updatedLabel: "Last updated:" },
  faq: {
    title: "Frequently Asked Questions",
    updated: "May 13, 2026",
    items: [
      {
        q: "What does a Vibranding proposal include?",
        a: "An audit of your current Instagram, a visual proposal for feed, bio and highlights, a content plan and, if applicable, a Meta Ads strategy with creative and suggested budget.",
      },
      {
        q: "Do you work with small brands?",
        a: "Yes. We adapt the scope to the size of your brand. Plans range from a single campaign to full monthly management.",
      },
      {
        q: "How long until I see results?",
        a: "Visual changes are immediate. Organic growth shows from the first month and paid campaigns deliver data in days.",
      },
      {
        q: "Do I need to share access to my accounts?",
        a: "For Meta Ads yes, through Business Manager. For organic Instagram we can work with proposals you approve and publish, or manage the account for you.",
      },
      {
        q: "How does payment work?",
        a: "We work with a deposit at the start and the balance on delivery or monthly depending on the plan. We accept bank transfer or payment link, in Chilean pesos (CLP), with an invoice from VIBRANDING SpA. Prices are net: 19% VAT (IVA) is added.",
      },
      {
        q: "Do we sign a contract?",
        a: "Yes, always. It includes scope, deadlines, payment terms and cancellation conditions.",
      },
      {
        q: "Can I cancel at any time?",
        a: "Monthly plans can be cancelled with 30 days notice. One-off projects are non-refundable once started.",
      },
      {
        q: "What if I don't like a proposal?",
        a: "We include up to two rounds of changes at no cost. Major changes are quoted separately.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "May 13, 2026",
    intro:
      "Welcome to Vibranding. By hiring our services or using this platform you accept the following terms.",
    blocks: [
      { type: "h2", text: "1. Services" },
      {
        type: "p",
        html: "Vibranding offers digital marketing services focused on Instagram and Meta Ads, including strategy, design, content management and paid campaigns. The specific scope is agreed in writing in each proposal.",
      },
      { type: "h2", text: "2. Payments" },
      {
        type: "p",
        html: "Fees and timelines are defined in the signed proposal. Unless otherwise agreed, a deposit is charged at the start. Late payments over 15 days may cause service suspension.",
      },
      { type: "h2", text: "3. Intellectual property" },
      {
        type: "p",
        html: "All delivered material becomes the client's property once fully paid. Vibranding keeps the right to showcase the work in its portfolio unless expressly requested otherwise.",
      },
      { type: "h2", text: "4. Results" },
      {
        type: "p",
        html: "We apply industry best practices, but we don't guarantee specific results in reach, followers or sales, since they depend on variables outside our control.",
      },
      { type: "h2", text: "5. Cancellation" },
      {
        type: "p",
        html: "Monthly plans can be cancelled with 30 days notice. One-off projects are non-refundable once started.",
      },
      { type: "h2", text: "6. Confidentiality" },
      {
        type: "p",
        html: "We treat all shared information as confidential and don't disclose it to third parties without authorization.",
      },
      { type: "h2", text: "7. Limitation of liability" },
      {
        type: "p",
        html: "Vibranding's maximum liability for any claim is limited to the amount paid by the client in the 3 months prior to the event giving rise to the claim.",
      },
      { type: "h2", text: "8. Modifications" },
      {
        type: "p",
        html: "We may update these terms. Changes apply from the moment they are published on this site.",
      },
      { type: "h2", text: "9. Contact" },
      {
        type: "p",
        html: "For questions or claims, contact us through the channels indicated on the site.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "October 5, 2026",
    intro:
      "At Vibranding we respect your privacy. This policy explains what data we collect and how we use it.",
    blocks: [
      { type: "h2", text: "1. Data we collect" },
      {
        type: "ul",
        items: [
          "Contact data: name, email, phone, brand or company.",
          "Account data: platform access credentials.",
          "Operational data: information about your campaigns and accounts that you share with us to deliver the service.",
          "Usage data: pages visited, events, device type.",
        ],
      },
      { type: "h2", text: "2. What we use it for" },
      {
        type: "ul",
        items: [
          "Provide and improve our services.",
          "Communicate with you about your project.",
          "Comply with legal and accounting obligations.",
        ],
      },
      {
        type: "p",
        html: "News and tips emails: we only send them if you expressly agree (for example, by ticking the optional, unticked box on the diagnosis form). It is voluntary and does not affect the diagnosis or any service. You can unsubscribe at any time by replying to any of those emails or writing to us, and we will stop sending them. We do not share your data with third parties for their own marketing.",
      },
      { type: "h2", text: "3. Sharing with third parties" },
      {
        type: "p",
        html: "We don't sell your data. We only share it with providers that help us operate (hosting, analytics, advertising platforms), under confidentiality agreements.",
      },
      { type: "h2", text: "4. Security" },
      {
        type: "p",
        html: "We apply reasonable technical and organizational measures to protect your information, including encryption in transit and access control.",
      },
      { type: "h2", text: "5. Your rights" },
      {
        type: "p",
        html: "You can access, correct or delete your data at any time by contacting us through the channels indicated on the site.",
      },
      { type: "h2", text: "6. Retention" },
      {
        type: "p",
        html: "We keep your data while the commercial relationship lasts and for as long as the law requires us to afterward.",
      },
      { type: "h2", text: "7. Changes" },
      { type: "p", html: "We may update this policy. We will publish changes on this same page." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: "May 13, 2026",
    intro:
      "This site uses cookies and similar technologies so the platform works and to understand how it is used.",
    blocks: [
      { type: "h2", text: "What is a cookie?" },
      {
        type: "p",
        html: "It's a small file a site stores in your browser to remember information, such as your session or your preferences.",
      },
      { type: "h2", text: "Types of cookies we use" },
      {
        type: "ul",
        items: [
          "<strong>Essential:</strong> required to sign in and keep your session active.",
          "<strong>Preferences:</strong> remember options like the active client or preferred view.",
          "<strong>Analytics:</strong> help us measure usage and improve the experience.",
        ],
      },
      { type: "h2", text: "Third-party cookies" },
      {
        type: "p",
        html: "If you interact with embedded Meta or Google elements, those platforms may set their own cookies. We recommend reviewing their policies.",
      },
      { type: "h2", text: "How to control them" },
      {
        type: "p",
        html: "You can delete or block cookies from your browser settings. Note that some features may stop working properly if you disable them.",
      },
      { type: "h2", text: "Contact" },
      {
        type: "p",
        html: "For questions about this policy, contact us through the channels indicated on the site.",
      },
    ],
  },
  dataDeletion: {
    title: "Data deletion instructions",
    updated: "May 17, 2026",
    intro:
      "At Vibranding we respect your right to control your personal data. If you'd like us to delete all the information associated with your account —including data obtained through the Meta (Facebook and Instagram) integration— you can request it by following the instructions on this page.",
    blocks: [
      { type: "h2", text: "1. What will be deleted" },
      {
        type: "ul",
        items: [
          "Your user account and access credentials.",
          "Your profile data and the clients you've created.",
          "Access tokens, identifiers and metrics obtained from Meta (Facebook/Instagram).",
          "Any content, goals or configuration stored on the platform.",
        ],
      },
      { type: "h2", text: "2. How to request deletion" },
      { type: "p", html: "You have two options:" },
      {
        type: "ul",
        items: [
          "<strong>From the app:</strong> sign in, go to your account settings and tap “Delete account”. The deletion is processed automatically.",
          '<strong>By email:</strong> send a message to <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a> from the address linked to your account, with “Data deletion request” as the subject.',
        ],
      },
      { type: "h2", text: "3. Timeline" },
      {
        type: "p",
        html: "We will process your request within a maximum of 30 days. Once completed, you will receive an email confirmation. Some data may be retained due to legal obligations (billing, fraud prevention) for the strictly necessary time.",
      },
      { type: "h2", text: "4. Revoke Meta permissions" },
      {
        type: "p",
        html: 'You can also revoke Vibranding\'s access to your Facebook or Instagram account from your Meta account settings, in <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer">Settings → Business Apps and Websites</a>. This stops the app\'s access to your data but does not delete information already stored at Vibranding: for that you must follow the steps above.',
      },
      { type: "h2", text: "5. Contact" },
      {
        type: "p",
        html: 'For any questions about how we handle your data, write to <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a>.',
      },
    ],
  },
  notFound: { title: "404", subtitle: "This page does not exist.", cta: "Back to home" },
  error: { title: "Something went wrong", cta: "Retry" },
  seo: {
    home: {
      title: "Vibranding — Grow on Instagram and Meta Ads with clear proposals",
      description:
        "Vibranding helps you plan, present and execute Instagram strategies and Meta Ads campaigns for your clients, all in one place.",
    },
    faq: {
      title: "FAQ — Vibranding",
      description:
        "Answers to the most common questions about our Instagram and Meta Ads services.",
    },
    terms: {
      title: "Terms of Service — Vibranding",
      description: "Terms and conditions that govern the use of Vibranding's services.",
    },
    privacy: {
      title: "Privacy Policy — Vibranding",
      description: "How Vibranding collects, uses and protects your personal data.",
    },
    cookies: {
      title: "Cookie Policy — Vibranding",
      description: "Which cookies Vibranding uses and how you can control them.",
    },
    dataDeletion: {
      title: "Data deletion — Vibranding",
      description: "How to request deletion of your personal data at Vibranding.",
    },
  },
};

export const translations: Record<Lang, Dict> = { es, en };
export type { Dict };
