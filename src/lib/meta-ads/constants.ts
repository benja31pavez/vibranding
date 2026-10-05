export const OBJECTIVES = {
  OUTCOME_AWARENESS: "Reconocimiento de marca",
  OUTCOME_TRAFFIC: "Tráfico",
  OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_LEADS: "Generación de clientes potenciales",
  OUTCOME_APP_PROMOTION: "Promoción de app",
  OUTCOME_SALES: "Ventas",
} as const;
export type Objective = keyof typeof OBJECTIVES;

export const BID_STRATEGIES = {
  LOWEST_COST_WITHOUT_CAP: "Costo más bajo (sin límite)",
  LOWEST_COST_WITH_BID_CAP: "Costo más bajo con tope de puja",
  COST_CAP: "Tope de costo",
  LOWEST_COST_WITH_MIN_ROAS: "ROAS mínimo",
} as const;
export type BidStrategy = keyof typeof BID_STRATEGIES;

export const OPTIMIZATION_GOALS = {
  LINK_CLICKS: "Clics en enlace",
  IMPRESSIONS: "Impresiones",
  REACH: "Alcance",
  LANDING_PAGE_VIEWS: "Vistas de página de destino",
  OFFSITE_CONVERSIONS: "Conversiones",
  LEAD_GENERATION: "Generación de leads",
  THRUPLAY: "Reproducciones de video",
} as const;
export type OptimizationGoal = keyof typeof OPTIMIZATION_GOALS;

export const BILLING_EVENTS = {
  IMPRESSIONS: "Impresiones",
  LINK_CLICKS: "Clics en enlace",
} as const;
export type BillingEvent = keyof typeof BILLING_EVENTS;

export const CTAS = {
  LEARN_MORE: "Más información",
  SHOP_NOW: "Comprar",
  SIGN_UP: "Registrarse",
  CONTACT_US: "Contáctanos",
  BOOK_TRAVEL: "Reservar",
  DOWNLOAD: "Descargar",
  GET_QUOTE: "Obtener cotización",
  SUBSCRIBE: "Suscribirse",
  WATCH_MORE: "Ver más",
  APPLY_NOW: "Aplicar ahora",
  GET_DIRECTIONS: "Cómo llegar",
  CALL_NOW: "Llamar",
  SEND_MESSAGE: "Enviar mensaje",
} as const;
export type CTA = keyof typeof CTAS;

export const PLACEMENT_GROUPS = {
  Facebook: [
    { id: "facebook_feed", label: "Feed" },
    { id: "facebook_stories", label: "Stories" },
    { id: "facebook_reels", label: "Reels" },
    { id: "facebook_marketplace", label: "Marketplace" },
    { id: "facebook_video_feeds", label: "Video in-stream" },
    { id: "facebook_search", label: "Búsqueda" },
  ],
  Instagram: [
    { id: "instagram_stream", label: "Feed" },
    { id: "instagram_stories", label: "Stories" },
    { id: "instagram_reels", label: "Reels" },
    { id: "instagram_explore", label: "Explore" },
  ],
  "Audience Network": [
    { id: "audience_network_classic", label: "Nativo / Banner" },
    { id: "audience_network_rewarded_video", label: "Intersticial" },
  ],
  Messenger: [
    { id: "messenger_inbox", label: "Inbox" },
    { id: "messenger_stories", label: "Stories" },
  ],
} as const;

export const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CA", name: "Canadá" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "ES", name: "España" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "IT", name: "Italia" },
  { code: "MX", name: "México" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panamá" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Perú" },
  { code: "PR", name: "Puerto Rico" },
  { code: "GB", name: "Reino Unido" },
  { code: "SV", name: "El Salvador" },
  { code: "US", name: "Estados Unidos" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "PT", name: "Portugal" },
  { code: "JP", name: "Japón" },
  { code: "AU", name: "Australia" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
];

export const LIMITS = {
  PRIMARY_TEXT: 125,
  HEADLINE: 40,
  DESCRIPTION: 30,
  CAROUSEL_MIN: 2,
  CAROUSEL_MAX: 10,
};

export const adsManagerUrl = (adAccountId: string, fbCampaignId: string) => {
  const acc = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;
  return `https://business.facebook.com/adsmanager/manage/campaigns?act=${acc}&selected_campaign_ids=${fbCampaignId}`;
};
