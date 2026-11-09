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
      {
        title: "Landing page",
        desc: "Una página para tu servicio con botón de WhatsApp y formulario, pensada para convertir visitas en consultas.",
      },
      {
        title: "Chatbot WhatsApp",
        desc: "Responde al instante las preguntas frecuentes de tus clientes y te deja las conversaciones listas para cerrar.",
      },
    ],
  },
  plans: {
    title: "Planes y",
    titleAccent: "precios",
    subtitle: "Precios netos en pesos chilenos, más IVA. Sin costos escondidos.",
    popular: "Más completo",
    cta: "Lo quiero",
    items: [
      {
        id: "marca-web",
        name: "Marca + Web",
        price: 149990,
        period: "pago único",
        terms: "Entrega en 2 a 3 semanas",
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
        terms: "Sin permanencia",
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
        terms: "Sin permanencia",
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
    updated: "6 de octubre de 2026",
    items: [
      {
        q: "¿Hay permanencia mínima?",
        a: "No. Marca + Web es un pago único. En los planes Contenido y Crecimiento cada pago cubre un mes de servicio y no hay cobros automáticos: para seguir, renuevas tu plan en la plataforma al terminar el mes. No hay devoluciones ni pausas.",
      },
      {
        q: "¿La pauta publicitaria está incluida?",
        a: "No. En el Plan Crecimiento nuestro precio cubre la creación, gestión y optimización de las campañas. La inversión en anuncios (pauta) la pagas directo a Meta y Google con tu tarjeta, así siempre sabes cuánto se gasta. Sugerimos partir desde $150.000 al mes.",
      },
      {
        q: "¿Cuánto se demoran?",
        a: "Marca + Web toma entre 2 y 3 semanas desde que recibimos tu información y el pago, con revisiones contigo antes de publicar. En los planes mensuales te enviamos el calendario de contenido durante la primera semana, y las campañas parten apenas apruebas los anuncios.",
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
    updated: "9 de noviembre de 2026",
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
      { type: "h2", text: "4. Pagos, renovación y término" },
      {
        type: "p",
        html: "Los planes mensuales no tienen permanencia mínima. Cada pago se realiza por adelantado en la plataforma y cubre un mes de servicio desde la fecha de pago. No hay cobros automáticos: para continuar, el cliente renueva al terminar el período; si no renueva, el servicio termina al cumplirse el mes pagado. Durante un período pagado no se puede cambiar de plan ni pausar el servicio. Los pagos no son reembolsables, sin perjuicio de los derechos que la ley otorgue al cliente.",
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
      { type: "h2", text: "8. Datos personales y uso de inteligencia artificial" },
      {
        type: "p",
        html: "Cuando el servicio incluye chatbot de WhatsApp, bandeja de mensajes o campañas, Vibranding trata datos personales de los clientes finales del cliente (por ejemplo, nombre, número de WhatsApp y contenido de los mensajes) por cuenta y encargo del cliente, quien es el responsable de esos datos. Vibranding actúa como encargado del tratamiento: los usa solo para prestar el servicio, siguiendo las instrucciones del cliente, con medidas de seguridad y confidencialidad, y los elimina o devuelve al término del servicio salvo obligación legal de conservarlos.",
      },
      {
        type: "p",
        html: "Las respuestas automáticas del chatbot se generan con herramientas de inteligencia artificial de proveedores externos. El cliente autoriza ese tratamiento y se compromete a informar a sus propios clientes de que conversan con un asistente automatizado y de que pueden pedir atención humana en cualquier momento. Las decisiones con efectos legales o significativos (por ejemplo, aceptar o rechazar un cobro) no se toman de forma únicamente automatizada.",
      },
      { type: "h2", text: "9. Limitación de responsabilidad" },
      {
        type: "p",
        html: "La responsabilidad máxima de Vibranding ante cualquier reclamo se limita al monto pagado por el cliente en los 3 meses anteriores al hecho que motiva el reclamo, en la medida que la ley lo permita.",
      },
      { type: "h2", text: "10. Modificaciones" },
      {
        type: "p",
        html: "Podemos actualizar estos términos. Las modificaciones aplican desde su publicación en este sitio.",
      },
      { type: "h2", text: "11. Ley aplicable y jurisdicción" },
      {
        type: "p",
        html: "Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales ordinarios de justicia de la ciudad de Santiago.",
      },
      { type: "h2", text: "12. Contacto" },
      {
        type: "p",
        html: 'VIBRANDING SpA · RUT 78.505.344-3 · Santiago, Chile. Para dudas o reclamos escríbenos por WhatsApp al +56 9 8929 4014 o a <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a>.',
      },
    ],
  },
  privacy: {
    title: "Política de Privacidad",
    updated: "9 de noviembre de 2026",
    intro:
      "El responsable del tratamiento de tus datos personales es VIBRANDING SpA, RUT 78.505.344-3, con domicilio en Santiago de Chile (“Vibranding”). Puedes escribirnos por cualquier tema de privacidad a privacidad@vibranding.pro. Tratamos tus datos conforme a la Ley 19.628 sobre protección de la vida privada, a la Ley 21.719 que la modifica y a esta política.",
    blocks: [
      { type: "h2", text: "1. Qué datos tratamos y para qué" },
      {
        type: "ul",
        items: [
          "<strong>Diagnóstico y contacto</strong> (nombre del negocio, rubro, comuna, correo, WhatsApp y lo que nos cuentes): para responder tu solicitud y prepararte una propuesta. Base de licitud: medidas precontractuales a petición tuya.",
          "<strong>Cuenta y portal</strong> (correo, nombre, credenciales, preferencias): para que entres a la plataforma y veas tu proyecto. Base: ejecución del contrato.",
          "<strong>Facturación</strong> (razón social, RUT, giro, dirección, correo de documentos, pagos): para cobrar, emitir factura o boleta y cumplir obligaciones tributarias. Base: ejecución del contrato y obligación legal.",
          "<strong>Operación del servicio</strong> (accesos a tus cuentas de Meta, Instagram, Google Ads y WhatsApp, métricas, contenidos y archivos que nos compartes): para ejecutar lo contratado. Base: ejecución del contrato.",
          "<strong>Mensajes de tus clientes</strong> por WhatsApp o Instagram cuando contratas chatbot o bandeja: los tratamos por tu encargo y siguiendo tus instrucciones; tú eres el responsable de esos datos.",
          "<strong>Uso del sitio</strong> (páginas vistas, origen de la visita, tipo de dispositivo e identificador diario anonimizado): para medir y mejorar el sitio. Base: interés legítimo; no te identificamos ni usamos cookies de terceros.",
          "<strong>Novedades y consejos por correo</strong>: solo si marcas la casilla opcional, que viene desmarcada. Base: tu consentimiento, que puedes retirar cuando quieras respondiendo a cualquier correo.",
        ],
      },
      { type: "h2", text: "2. Decisiones automatizadas e inteligencia artificial" },
      {
        type: "p",
        html: "Si contratas el chatbot de WhatsApp, las respuestas automáticas a tus clientes se generan con herramientas de inteligencia artificial de proveedores externos, a partir del contenido de la conversación y de la información de tu negocio que nos entregas. Siempre existe la opción de pedir atención humana y ninguna decisión con efectos legales o significativos se toma de forma únicamente automatizada. No elaboramos perfiles con fines distintos a prestar el servicio.",
      },
      { type: "h2", text: "3. Con quién compartimos tus datos" },
      {
        type: "p",
        html: "No vendemos tus datos ni los cedemos a terceros para su propia publicidad. Los tratan por nuestro encargo los proveedores que necesitamos para operar, bajo contrato y con medidas de seguridad:",
      },
      {
        type: "ul",
        items: [
          "<strong>Supabase</strong> (base de datos y autenticación) y <strong>Cloudflare</strong> (alojamiento, red y protección), con servidores en Estados Unidos y la Unión Europea.",
          "<strong>Meta</strong> (Facebook, Instagram y WhatsApp) y <strong>Google</strong> (Google Ads y Google Business), según las cuentas que conectes; cada una con sus propias políticas.",
          "<strong>Resend</strong> (envío de correos transaccionales) y <strong>Flow</strong> (pagos en línea en Chile).",
          "<strong>Lovable</strong> (infraestructura de la aplicación y pasarela de inteligencia artificial del chatbot).",
          "Organismos públicos cuando la ley lo exige (por ejemplo, el Servicio de Impuestos Internos).",
        ],
      },
      {
        type: "p",
        html: "Algunos de estos proveedores están fuera de Chile. Cuando transferimos datos al extranjero lo hacemos a proveedores que ofrecen un nivel adecuado de protección o con garantías contractuales equivalentes.",
      },
      { type: "h2", text: "4. Cuánto tiempo los conservamos" },
      {
        type: "ul",
        items: [
          "Solicitudes de diagnóstico sin contratación: hasta 12 meses desde el último contacto.",
          "Datos de cuenta y operación del servicio: mientras dure la relación y hasta 12 meses después, salvo que pidas antes su eliminación.",
          "Conversaciones de WhatsApp e Instagram tratadas por tu encargo: mientras dure el servicio; al terminar se eliminan o se te devuelven.",
          "Documentos tributarios y de pago: 6 años, por obligación legal.",
          "Registros de uso del sitio: 13 meses, de forma anonimizada.",
        ],
      },
      { type: "h2", text: "5. Tus derechos" },
      {
        type: "p",
        html: "Puedes pedir acceso a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento, limitarlo o bloquearlo, solicitar su portabilidad y retirar tu consentimiento cuando este sea la base del tratamiento. También puedes pedir que una persona revise cualquier decisión automatizada que te afecte. Para ejercerlos escríbenos a privacidad@vibranding.pro desde el correo asociado a tu cuenta; respondemos en un plazo máximo de 30 días. Si no quedas conforme, puedes reclamar ante la Agencia de Protección de Datos Personales.",
      },
      { type: "h2", text: "6. Seguridad" },
      {
        type: "p",
        html: "Ciframos la información en tránsito, guardamos las credenciales de tus cuentas conectadas en un almacén cifrado separado de la base de datos, restringimos el acceso por rol, verificamos la firma de todos los webhooks que recibimos y no guardamos tu dirección IP en claro. Ningún sistema es infalible: si ocurre una brecha que te afecte, te avisaremos sin demora.",
      },
      { type: "h2", text: "7. Menores de edad" },
      {
        type: "p",
        html: "Nuestros servicios están dirigidos a empresas y profesionales. No recopilamos a sabiendas datos de menores de 14 años.",
      },
      { type: "h2", text: "8. Cambios" },
      {
        type: "p",
        html: "Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha. Si el cambio es relevante para ti, te avisaremos por correo.",
      },
      { type: "h2", text: "9. Contacto" },
      {
        type: "p",
        html: 'VIBRANDING SpA · RUT 78.505.344-3 · Santiago, Chile · <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a> · WhatsApp +56 9 8929 4014.',
      },
    ],
  },
  cookies: {
    title: "Política de Cookies",
    updated: "9 de noviembre de 2026",
    intro:
      "Este sitio usa solo las cookies y el almacenamiento local necesarios para que funcione. No usamos cookies de publicidad ni de analítica de terceros; por eso no verás un aviso de cookies.",
    blocks: [
      { type: "h2", text: "¿Qué es una cookie?" },
      {
        type: "p",
        html: "Es un pequeño archivo que un sitio guarda en tu navegador para recordar información, como tu sesión. El almacenamiento local (localStorage y sessionStorage) cumple una función parecida, pero no se envía al servidor en cada petición.",
      },
      { type: "h2", text: "Lo que usamos" },
      {
        type: "ul",
        items: [
          "<strong>Sesión</strong> (<code>sb-*-auth-token</code>): mantiene tu sesión iniciada en la plataforma. Esencial. Dura mientras la sesión esté activa.",
          "<strong>Conexión de cuentas</strong> (<code>vb_oauth_*</code>): protege el proceso de conectar Meta o Google con un código de un solo uso. Esencial. Dura 10 minutos.",
          "<strong>Preferencias</strong> (<code>vibranding:*</code> en localStorage): recuerda el cliente activo y la vista preferida dentro del panel.",
          "<strong>Medición propia</strong> (<code>vb:analytics:*</code> en localStorage y sessionStorage): un identificador que cambia cada día y no permite reconocerte entre un día y otro; sirve para contar visitas y saber qué secciones se usan. No se comparte con terceros.",
        ],
      },
      { type: "h2", text: "Servicios de terceros" },
      {
        type: "p",
        html: "Si conectas tus cuentas de Meta o Google desde el panel, esas plataformas pueden usar sus propias cookies durante el proceso de autorización, según sus políticas. En el sitio público no cargamos píxeles ni scripts de terceros.",
      },
      { type: "h2", text: "Cómo controlarlas" },
      {
        type: "p",
        html: "Puedes borrar o bloquear cookies y almacenamiento desde la configuración de tu navegador. Si bloqueas las esenciales, no podrás iniciar sesión en la plataforma.",
      },
      { type: "h2", text: "Contacto" },
      {
        type: "p",
        html: 'Dudas sobre esta política: <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a>.',
      },
    ],
  },
  dataDeletion: {
    title: "Instrucciones para la eliminación de datos",
    updated: "9 de noviembre de 2026",
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
      {
        type: "p",
        html: 'Envía un correo a <a href="mailto:privacidad@vibranding.pro">privacidad@vibranding.pro</a> desde la dirección asociada a tu cuenta, con el asunto “Solicitud de eliminación de datos”. Si prefieres, también puedes pedirlo por WhatsApp al +56 9 8929 4014 indicando el correo de tu cuenta. Te confirmaremos la recepción el mismo día hábil.',
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

// La versión en inglés se retiró: tenía términos y preguntas frecuentes antiguos que
// contradecían la versión vigente en español. El sitio es solo en español (Chile).
const en: Dict = es;

export const translations: Record<Lang, Dict> = { es, en };
export type { Dict };
