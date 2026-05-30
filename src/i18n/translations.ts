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

type Dict = {
  langSwitcher: { label: string; es: string; en: string };
  nav: { services: string; how: string; about: string; clients: string; contact: string; signIn: string };
  hero: {
    badge: string;
    title1: string;
    titleAccent: string;
    titleEnd: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  services: {
    eyebrow: string;
    accent: string;
    subtitle: string;
    items: { title: string; desc: string; why: string }[];
  };
  how: {
    eyebrow: string;
    accent: string;
    steps: { n: string; t: string; d: string }[];
  };
  about: {
    eyebrow: string;
    accent: string;
    title: string;
    subtitle: string;
    paragraph1: string;
    paragraph2: string;
    chips: string[];
    antonia: { name: string; role: string; bio: string };
    benjamin: { name: string; role: string; bio: string };
  };
  clients: {
    eyebrow: string;
    accent: string;
    subtitle: string;
    viewWork: string;
    empty: string;
  };
  contact: {
    title1: string;
    accent: string;
    title2: string;
    subtitle: string;
    whatsapp: string;
    whatsappMessage: string;
    bullets: string[];
  };
  footer: {
    tagline: string;
    columns: { product: string; resources: string; legal: string };
    links: {
      services: string;
      how: string;
      about: string;
      clients: string;
      contact: string;
      faq: string;
      terms: string;
      privacy: string;
      cookies: string;
    };
    rights: string;
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
  nav: { services: "Servicios", how: "Cómo funciona", about: "Nosotros", clients: "Clientes", contact: "Contacto", signIn: "Iniciar sesión" },
  hero: {
    badge: "Especialistas en Instagram y Meta Ads",
    title1: "Hacemos que tu marca ",
    titleAccent: "vibre de verdad",
    titleEnd: ".",
    subtitle: "",
    ctaPrimary: "Hablemos de tu marca",
    ctaSecondary: "Ver servicios",
  },
  services: {
    eyebrow: "Lo que",
    accent: "hacemos",
    subtitle: "",
    items: [
      { title: "Estrategia de Instagram", desc: "Auditoría de perfil, rediseño visual, calendario de contenido y propuestas con vista previa estilo iPhone." },
      { title: "Meta Ads", desc: "Campañas de Facebook e Instagram Ads: creatividades, segmentación, presupuesto y optimización." },
      { title: "Reportes claros", desc: "Métricas, objetivos y entregables visibles para tu cliente. PDFs listos para presentar." },
    ],
  },
  how: {
    eyebrow: "Cómo",
    accent: "trabajamos",
    steps: [
      { n: "01", t: "Diagnóstico", d: "Analizamos tu marca, tu público y tu competencia." },
      { n: "02", t: "Propuesta", d: "Te entregamos una visión clara con objetivos, contenido y campañas." },
      { n: "03", t: "Ejecución", d: "Producimos, publicamos, anunciamos y medimos resultados." },
    ],
  },
  about: {
    eyebrow: "Quiénes",
    accent: "somos",
    title: "Quiénes",
    subtitle: "Somos Antonia y Benjamín, un equipo chileno que combina diseño gráfico y publicidad para hacer crecer marcas desde Santiago.",
    paragraph1: "Trabajamos en conjunto: estrategia, identidad visual, campañas y contenido. Sin intermediarios y con foco en resultados.",
    paragraph2: "",
    chips: ["Santiago, Chile", "Diseño + publicidad", "Trato directo"],
    antonia: { name: "Antonia", role: "Diseñadora Gráfica", bio: "Lidera identidad, feed y piezas visuales de cada marca." },
    benjamin: { name: "Benjamín", role: "Publicista", bio: "Define estrategia y campañas para llegar a la persona correcta." },
  },
  clients: {
    eyebrow: "Marcas con las que",
    accent: "hemos trabajado",
    subtitle: "",
    viewWork: "Ver trabajo",
    empty: "Pronto compartiremos nuestros próximos casos.",
  },
  contact: {
    title1: "¿Listo para ",
    accent: "vibrar",
    title2: " con nosotros?",
    subtitle: "Cuéntanos sobre tu marca y te respondemos con una propuesta personalizada.",
    whatsapp: "Escríbenos por WhatsApp",
    whatsappMessage: "Hola Vibranding, me gustaría saber más sobre sus servicios.",
    bullets: ["Respuesta en 24h", "Sin compromiso", "Plan a tu medida"],
  },
  footer: {
    tagline: "Crecemos tu marca en Instagram y Meta Ads con estrategia, diseño y datos.",
    columns: { product: "Producto", resources: "Recursos", legal: "Legal" },
    links: {
      services: "Servicios",
      how: "Cómo funciona",
      about: "Nosotros",
      clients: "Clientes",
      contact: "Contacto",
      faq: "Preguntas Frecuentes",
      terms: "Términos de Servicio",
      privacy: "Política de Privacidad",
      cookies: "Cookies",
    },
    rights: "Todos los derechos reservados.",
  },
  legal: { back: "Volver al inicio", updatedLabel: "Última actualización:" },
  faq: {
    title: "Preguntas Frecuentes",
    updated: "13 de mayo de 2026",
    items: [
      { q: "¿Qué incluye una propuesta de Vibranding?", a: "Una auditoría de tu Instagram actual, una propuesta visual de feed, biografía y destacados, un plan de contenido y, si aplica, una estrategia de Meta Ads con creatividades y presupuesto sugerido." },
      { q: "¿Trabajan con marcas pequeñas?", a: "Sí. Adaptamos el alcance al tamaño de tu marca. Tenemos planes desde una sola campaña hasta gestión mensual completa." },
      { q: "¿Cuánto tarda en verse resultados?", a: "Los cambios visuales son inmediatos. El crecimiento orgánico se nota desde el primer mes y las campañas pagadas entregan datos en días." },
      { q: "¿Necesito entregarles acceso a mis cuentas?", a: "Para Meta Ads sí, mediante Business Manager. Para Instagram orgánico podemos trabajar con propuestas que tú apruebas y publicas, o gestionar la cuenta por ti." },
      { q: "¿Cómo se hace el pago?", a: "Trabajamos con un anticipo al iniciar y el saldo a la entrega o mensualmente según el plan. Aceptamos transferencia y pagos en USD o moneda local." },
      { q: "¿Firmamos un contrato?", a: "Sí, siempre. Incluye alcance, plazos, formas de pago y condiciones de cancelación." },
      { q: "¿Puedo cancelar en cualquier momento?", a: "Los planes mensuales se pueden cancelar con 30 días de aviso. Los proyectos puntuales son no reembolsables una vez iniciados." },
      { q: "¿Qué pasa si no me gusta una propuesta?", a: "Incluimos hasta dos rondas de cambios sin costo. Cambios mayores se cotizan aparte." },
    ],
  },
  terms: {
    title: "Términos de Servicio",
    updated: "13 de mayo de 2026",
    intro: "Bienvenido a Vibranding. Al contratar nuestros servicios o usar esta plataforma aceptas los siguientes términos.",
    blocks: [
      { type: "h2", text: "1. Servicios" },
      { type: "p", html: "Vibranding ofrece servicios de marketing digital enfocados en Instagram y Meta Ads, incluyendo estrategia, diseño, gestión de contenido y campañas pagadas. El alcance específico se acuerda por escrito en cada propuesta." },
      { type: "h2", text: "2. Pagos" },
      { type: "p", html: "Los honorarios y plazos se definen en la propuesta firmada. Salvo acuerdo distinto, se cobra un anticipo al inicio. La mora superior a 15 días puede causar la suspensión del servicio." },
      { type: "h2", text: "3. Propiedad intelectual" },
      { type: "p", html: "Todo el material entregado pasa a ser propiedad del cliente una vez pagado en su totalidad. Vibranding conserva el derecho de mostrar el trabajo en su portafolio salvo solicitud expresa." },
      { type: "h2", text: "4. Resultados" },
      { type: "p", html: "Aplicamos buenas prácticas de la industria, pero no garantizamos resultados específicos en alcance, seguidores o ventas, ya que dependen de variables fuera de nuestro control." },
      { type: "h2", text: "5. Cancelación" },
      { type: "p", html: "Los planes mensuales pueden cancelarse con 30 días de aviso. Los proyectos puntuales no son reembolsables una vez iniciados." },
      { type: "h2", text: "6. Confidencialidad" },
      { type: "p", html: "Tratamos toda la información compartida como confidencial y no la revelamos a terceros sin autorización." },
      { type: "h2", text: "7. Limitación de responsabilidad" },
      { type: "p", html: "La responsabilidad máxima de Vibranding ante cualquier reclamo se limita al monto pagado por el cliente en los 3 meses anteriores al hecho que motiva el reclamo." },
      { type: "h2", text: "8. Modificaciones" },
      { type: "p", html: "Podemos actualizar estos términos. Las modificaciones aplican a partir de su publicación en este sitio." },
      { type: "h2", text: "9. Contacto" },
      { type: "p", html: "Para dudas o reclamos, contáctanos por los canales indicados en el sitio." },
    ],
  },
  privacy: {
    title: "Política de Privacidad",
    updated: "13 de mayo de 2026",
    intro: "En Vibranding respetamos tu privacidad. Esta política explica qué datos recopilamos y cómo los usamos.",
    blocks: [
      { type: "h2", text: "1. Datos que recopilamos" },
      { type: "ul", items: [
        "Datos de contacto: nombre, email, teléfono, marca o empresa.",
        "Datos de cuenta: credenciales de acceso a la plataforma.",
        "Datos operativos: información de tus campañas y cuentas que tú nos compartes para ejecutar el servicio.",
        "Datos de uso: páginas visitadas, eventos, tipo de dispositivo.",
      ] },
      { type: "h2", text: "2. Para qué los usamos" },
      { type: "ul", items: [
        "Prestar y mejorar nuestros servicios.",
        "Comunicarnos contigo sobre tu proyecto.",
        "Cumplir obligaciones legales y contables.",
      ] },
      { type: "h2", text: "3. Compartir con terceros" },
      { type: "p", html: "No vendemos tus datos. Solo los compartimos con proveedores que nos ayudan a operar (hosting, analítica, plataformas de publicidad), bajo acuerdos de confidencialidad." },
      { type: "h2", text: "4. Seguridad" },
      { type: "p", html: "Aplicamos medidas técnicas y organizativas razonables para proteger tu información, incluyendo cifrado en tránsito y control de accesos." },
      { type: "h2", text: "5. Tus derechos" },
      { type: "p", html: "Puedes acceder, corregir o eliminar tus datos en cualquier momento contactándonos por los canales indicados en el sitio." },
      { type: "h2", text: "6. Conservación" },
      { type: "p", html: "Conservamos tus datos mientras dure la relación comercial y por el tiempo que la ley nos exija después." },
      { type: "h2", text: "7. Cambios" },
      { type: "p", html: "Podemos actualizar esta política. Publicaremos los cambios en esta misma página." },
    ],
  },
  cookies: {
    title: "Política de Cookies",
    updated: "13 de mayo de 2026",
    intro: "Este sitio usa cookies y tecnologías similares para que la plataforma funcione y para entender cómo se utiliza.",
    blocks: [
      { type: "h2", text: "¿Qué es una cookie?" },
      { type: "p", html: "Es un pequeño archivo que un sitio guarda en tu navegador para recordar información, como tu sesión o tus preferencias." },
      { type: "h2", text: "Tipos de cookies que usamos" },
      { type: "ul", items: [
        "<strong>Esenciales:</strong> necesarias para iniciar sesión y mantener tu sesión activa.",
        "<strong>De preferencias:</strong> recuerdan opciones como cliente activo o vista preferida.",
        "<strong>De analítica:</strong> nos ayudan a medir el uso y mejorar la experiencia.",
      ] },
      { type: "h2", text: "Cookies de terceros" },
      { type: "p", html: "Si interactúas con elementos integrados de Meta o Google, esas plataformas pueden colocar sus propias cookies. Te recomendamos revisar sus políticas." },
      { type: "h2", text: "Cómo controlarlas" },
      { type: "p", html: "Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que algunas funciones pueden dejar de operar correctamente si las desactivas." },
      { type: "h2", text: "Contacto" },
      { type: "p", html: "Para dudas sobre esta política, contáctanos por los canales indicados en el sitio." },
    ],
  },
  dataDeletion: {
    title: "Instrucciones para la eliminación de datos",
    updated: "17 de mayo de 2026",
    intro: "En Vibranding respetamos tu derecho a controlar tus datos personales. Si deseas que eliminemos toda la información asociada a tu cuenta —incluidos los datos obtenidos a través de la integración con Meta (Facebook e Instagram)— puedes solicitarlo siguiendo las instrucciones de esta página.",
    blocks: [
      { type: "h2", text: "1. Qué se eliminará" },
      { type: "ul", items: [
        "Tu cuenta de usuario y credenciales de acceso.",
        "Los datos de tu perfil y de los clientes que hayas creado.",
        "Tokens de acceso, identificadores y métricas obtenidas desde Meta (Facebook/Instagram).",
        "Cualquier contenido, objetivo o configuración almacenada en la plataforma.",
      ] },
      { type: "h2", text: "2. Cómo solicitar la eliminación" },
      { type: "p", html: "Tienes dos opciones:" },
      { type: "ul", items: [
        "<strong>Desde la app:</strong> inicia sesión, ve a los ajustes de tu cuenta y pulsa “Eliminar cuenta”. La eliminación se procesa de forma automática.",
        "<strong>Por email:</strong> envía un correo a <a href=\"mailto:privacidad@vibranding.pro\">privacidad@vibranding.pro</a> desde la dirección asociada a tu cuenta, indicando “Solicitud de eliminación de datos” en el asunto.",
      ] },
      { type: "h2", text: "3. Plazo" },
      { type: "p", html: "Procesaremos tu solicitud en un plazo máximo de 30 días. Una vez completada, recibirás una confirmación por correo electrónico. Algunos datos pueden conservarse por obligaciones legales (facturación, prevención de fraude) durante el tiempo estrictamente necesario." },
      { type: "h2", text: "4. Revocar permisos de Meta" },
      { type: "p", html: "También puedes revocar el acceso de Vibranding a tu cuenta de Facebook o Instagram desde la configuración de tu cuenta de Meta, en <a href=\"https://www.facebook.com/settings?tab=business_tools\" target=\"_blank\" rel=\"noopener noreferrer\">Configuración → Apps y sitios web empresariales</a>. Esto detendrá el acceso de la app a tus datos, pero no elimina la información ya almacenada en Vibranding: para ello debes seguir los pasos anteriores." },
      { type: "h2", text: "5. Contacto" },
      { type: "p", html: "Para cualquier duda sobre el tratamiento de tus datos, escríbenos a <a href=\"mailto:privacidad@vibranding.pro\">privacidad@vibranding.pro</a>." },
    ],
  },
  notFound: { title: "404", subtitle: "Esta página no existe.", cta: "Volver al inicio" },
  error: { title: "Algo salió mal", cta: "Reintentar" },
  seo: {
    home: { title: "Vibranding — Instagram & Meta Ads", description: "Vibranding te ayuda a planear, presentar y ejecutar estrategias de Instagram y campañas de Meta Ads para tus clientes, todo en un mismo lugar." },
    faq: { title: "Preguntas Frecuentes — Vibranding", description: "Respuestas a las dudas más comunes sobre nuestros servicios de Instagram y Meta Ads." },
    terms: { title: "Términos de Servicio — Vibranding", description: "Términos y condiciones que regulan el uso de los servicios de Vibranding." },
    privacy: { title: "Política de Privacidad — Vibranding", description: "Cómo Vibranding recopila, usa y protege tus datos personales." },
    cookies: { title: "Política de Cookies — Vibranding", description: "Qué cookies usa Vibranding y cómo puedes controlarlas." },
    dataDeletion: { title: "Eliminación de datos — Vibranding", description: "Cómo solicitar la eliminación de tus datos personales en Vibranding." },
  },
};

const en: Dict = {
  langSwitcher: { label: "Language", es: "ES", en: "EN" },
  nav: { services: "Services", how: "How it works", about: "About", clients: "Clients", contact: "Contact", signIn: "Sign in" },
  hero: {
    badge: "Instagram & Meta Ads specialists",
    title1: "We make your brand ",
    titleAccent: "truly vibrate",
    titleEnd: ".",
    subtitle: "",
    ctaPrimary: "Let's talk about your brand",
    ctaSecondary: "See services",
  },
  services: {
    eyebrow: "What we",
    accent: "do",
    subtitle: "",
    items: [
      { title: "Instagram strategy", desc: "Profile audit, visual redesign, content calendar and proposals with an iPhone-style preview." },
      { title: "Meta Ads", desc: "Facebook and Instagram Ads campaigns: creative, targeting, budget and optimization." },
      { title: "Clear reports", desc: "Metrics, goals and deliverables your client can see. Ready-to-present PDFs." },
    ],
  },
  how: {
    eyebrow: "How we",
    accent: "work",
    steps: [
      { n: "01", t: "Diagnosis", d: "We analyze your brand, your audience and your competition." },
      { n: "02", t: "Proposal", d: "We deliver a clear vision with goals, content and campaigns." },
      { n: "03", t: "Execution", d: "We produce, publish, advertise and measure results." },
    ],
  },
  about: {
    eyebrow: "Who",
    accent: "we are",
    title: "Who",
    subtitle: "We're Antonia and Benjamín, a Chilean team blending graphic design and advertising to grow brands from Santiago.",
    paragraph1: "We work together across strategy, visual identity, campaigns and content. No middlemen, focused on results.",
    paragraph2: "",
    chips: ["Santiago, Chile", "Design + advertising", "Direct relationship"],
    antonia: { name: "Antonia", role: "Graphic Designer", bio: "Leads identity, feed and visual pieces for every brand." },
    benjamin: { name: "Benjamín", role: "Advertiser", bio: "Defines strategy and campaigns to reach the right person." },
  },
  clients: {
    eyebrow: "Brands we've",
    accent: "worked with",
    subtitle: "",
    viewWork: "View work",
    empty: "We'll share our next case studies soon.",
  },
  contact: {
    title1: "Ready to ",
    accent: "vibrate",
    title2: " with us?",
    subtitle: "Tell us about your brand and we'll reply with a tailored proposal.",
    whatsapp: "Message us on WhatsApp",
    whatsappMessage: "Hi Vibranding, I'd like to learn more about your services.",
    bullets: ["Reply within 24h", "No commitment", "Plan tailored to you"],
  },
  footer: {
    tagline: "We grow your brand on Instagram and Meta Ads with strategy, design and data.",
    columns: { product: "Product", resources: "Resources", legal: "Legal" },
    links: {
      services: "Services",
      how: "How it works",
      about: "About",
      clients: "Clients",
      contact: "Contact",
      faq: "FAQ",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      cookies: "Cookies",
    },
    rights: "All rights reserved.",
  },
  legal: { back: "Back to home", updatedLabel: "Last updated:" },
  faq: {
    title: "Frequently Asked Questions",
    updated: "May 13, 2026",
    items: [
      { q: "What does a Vibranding proposal include?", a: "An audit of your current Instagram, a visual proposal for feed, bio and highlights, a content plan and, if applicable, a Meta Ads strategy with creative and suggested budget." },
      { q: "Do you work with small brands?", a: "Yes. We adapt the scope to the size of your brand. Plans range from a single campaign to full monthly management." },
      { q: "How long until I see results?", a: "Visual changes are immediate. Organic growth shows from the first month and paid campaigns deliver data in days." },
      { q: "Do I need to share access to my accounts?", a: "For Meta Ads yes, through Business Manager. For organic Instagram we can work with proposals you approve and publish, or manage the account for you." },
      { q: "How does payment work?", a: "We work with a deposit at the start and the balance on delivery or monthly depending on the plan. We accept bank transfer and payments in USD or local currency." },
      { q: "Do we sign a contract?", a: "Yes, always. It includes scope, deadlines, payment terms and cancellation conditions." },
      { q: "Can I cancel at any time?", a: "Monthly plans can be cancelled with 30 days notice. One-off projects are non-refundable once started." },
      { q: "What if I don't like a proposal?", a: "We include up to two rounds of changes at no cost. Major changes are quoted separately." },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "May 13, 2026",
    intro: "Welcome to Vibranding. By hiring our services or using this platform you accept the following terms.",
    blocks: [
      { type: "h2", text: "1. Services" },
      { type: "p", html: "Vibranding offers digital marketing services focused on Instagram and Meta Ads, including strategy, design, content management and paid campaigns. The specific scope is agreed in writing in each proposal." },
      { type: "h2", text: "2. Payments" },
      { type: "p", html: "Fees and timelines are defined in the signed proposal. Unless otherwise agreed, a deposit is charged at the start. Late payments over 15 days may cause service suspension." },
      { type: "h2", text: "3. Intellectual property" },
      { type: "p", html: "All delivered material becomes the client's property once fully paid. Vibranding keeps the right to showcase the work in its portfolio unless expressly requested otherwise." },
      { type: "h2", text: "4. Results" },
      { type: "p", html: "We apply industry best practices, but we don't guarantee specific results in reach, followers or sales, since they depend on variables outside our control." },
      { type: "h2", text: "5. Cancellation" },
      { type: "p", html: "Monthly plans can be cancelled with 30 days notice. One-off projects are non-refundable once started." },
      { type: "h2", text: "6. Confidentiality" },
      { type: "p", html: "We treat all shared information as confidential and don't disclose it to third parties without authorization." },
      { type: "h2", text: "7. Limitation of liability" },
      { type: "p", html: "Vibranding's maximum liability for any claim is limited to the amount paid by the client in the 3 months prior to the event giving rise to the claim." },
      { type: "h2", text: "8. Modifications" },
      { type: "p", html: "We may update these terms. Changes apply from the moment they are published on this site." },
      { type: "h2", text: "9. Contact" },
      { type: "p", html: "For questions or claims, contact us through the channels indicated on the site." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "May 13, 2026",
    intro: "At Vibranding we respect your privacy. This policy explains what data we collect and how we use it.",
    blocks: [
      { type: "h2", text: "1. Data we collect" },
      { type: "ul", items: [
        "Contact data: name, email, phone, brand or company.",
        "Account data: platform access credentials.",
        "Operational data: information about your campaigns and accounts that you share with us to deliver the service.",
        "Usage data: pages visited, events, device type.",
      ] },
      { type: "h2", text: "2. What we use it for" },
      { type: "ul", items: [
        "Provide and improve our services.",
        "Communicate with you about your project.",
        "Comply with legal and accounting obligations.",
      ] },
      { type: "h2", text: "3. Sharing with third parties" },
      { type: "p", html: "We don't sell your data. We only share it with providers that help us operate (hosting, analytics, advertising platforms), under confidentiality agreements." },
      { type: "h2", text: "4. Security" },
      { type: "p", html: "We apply reasonable technical and organizational measures to protect your information, including encryption in transit and access control." },
      { type: "h2", text: "5. Your rights" },
      { type: "p", html: "You can access, correct or delete your data at any time by contacting us through the channels indicated on the site." },
      { type: "h2", text: "6. Retention" },
      { type: "p", html: "We keep your data while the commercial relationship lasts and for as long as the law requires us to afterward." },
      { type: "h2", text: "7. Changes" },
      { type: "p", html: "We may update this policy. We will publish changes on this same page." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: "May 13, 2026",
    intro: "This site uses cookies and similar technologies so the platform works and to understand how it is used.",
    blocks: [
      { type: "h2", text: "What is a cookie?" },
      { type: "p", html: "It's a small file a site stores in your browser to remember information, such as your session or your preferences." },
      { type: "h2", text: "Types of cookies we use" },
      { type: "ul", items: [
        "<strong>Essential:</strong> required to sign in and keep your session active.",
        "<strong>Preferences:</strong> remember options like the active client or preferred view.",
        "<strong>Analytics:</strong> help us measure usage and improve the experience.",
      ] },
      { type: "h2", text: "Third-party cookies" },
      { type: "p", html: "If you interact with embedded Meta or Google elements, those platforms may set their own cookies. We recommend reviewing their policies." },
      { type: "h2", text: "How to control them" },
      { type: "p", html: "You can delete or block cookies from your browser settings. Note that some features may stop working properly if you disable them." },
      { type: "h2", text: "Contact" },
      { type: "p", html: "For questions about this policy, contact us through the channels indicated on the site." },
    ],
  },
  dataDeletion: {
    title: "Data deletion instructions",
    updated: "May 17, 2026",
    intro: "At Vibranding we respect your right to control your personal data. If you'd like us to delete all the information associated with your account —including data obtained through the Meta (Facebook and Instagram) integration— you can request it by following the instructions on this page.",
    blocks: [
      { type: "h2", text: "1. What will be deleted" },
      { type: "ul", items: [
        "Your user account and access credentials.",
        "Your profile data and the clients you've created.",
        "Access tokens, identifiers and metrics obtained from Meta (Facebook/Instagram).",
        "Any content, goals or configuration stored on the platform.",
      ] },
      { type: "h2", text: "2. How to request deletion" },
      { type: "p", html: "You have two options:" },
      { type: "ul", items: [
        "<strong>From the app:</strong> sign in, go to your account settings and tap “Delete account”. The deletion is processed automatically.",
        "<strong>By email:</strong> send a message to <a href=\"mailto:privacidad@vibranding.pro\">privacidad@vibranding.pro</a> from the address linked to your account, with “Data deletion request” as the subject.",
      ] },
      { type: "h2", text: "3. Timeline" },
      { type: "p", html: "We will process your request within a maximum of 30 days. Once completed, you will receive an email confirmation. Some data may be retained due to legal obligations (billing, fraud prevention) for the strictly necessary time." },
      { type: "h2", text: "4. Revoke Meta permissions" },
      { type: "p", html: "You can also revoke Vibranding's access to your Facebook or Instagram account from your Meta account settings, in <a href=\"https://www.facebook.com/settings?tab=business_tools\" target=\"_blank\" rel=\"noopener noreferrer\">Settings → Business Apps and Websites</a>. This stops the app's access to your data but does not delete information already stored at Vibranding: for that you must follow the steps above." },
      { type: "h2", text: "5. Contact" },
      { type: "p", html: "For any questions about how we handle your data, write to <a href=\"mailto:privacidad@vibranding.pro\">privacidad@vibranding.pro</a>." },
    ],
  },
  notFound: { title: "404", subtitle: "This page does not exist.", cta: "Back to home" },
  error: { title: "Something went wrong", cta: "Retry" },
  seo: {
    home: { title: "Vibranding — Grow on Instagram and Meta Ads with clear proposals", description: "Vibranding helps you plan, present and execute Instagram strategies and Meta Ads campaigns for your clients, all in one place." },
    faq: { title: "FAQ — Vibranding", description: "Answers to the most common questions about our Instagram and Meta Ads services." },
    terms: { title: "Terms of Service — Vibranding", description: "Terms and conditions that govern the use of Vibranding's services." },
    privacy: { title: "Privacy Policy — Vibranding", description: "How Vibranding collects, uses and protects your personal data." },
    cookies: { title: "Cookie Policy — Vibranding", description: "Which cookies Vibranding uses and how you can control them." },
    dataDeletion: { title: "Data deletion — Vibranding", description: "How to request deletion of your personal data at Vibranding." },
  },
};

export const translations: Record<Lang, Dict> = { es, en };
export type { Dict };
