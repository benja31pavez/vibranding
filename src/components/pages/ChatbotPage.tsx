/**
 * La pantalla de WhatsApp vive en `@/components/chatbot/WhatsAppSectionPage`
 * (Resumen · Chatbot · Bandeja de mensajes · Plantillas). Aquí queda el tipo de la
 * cuenta, que comparten la tarjeta de conexión, el chatbot y el perfil del negocio.
 */
export type WAAccount = {
  id: string;
  client_id: string;
  phone_number_id: string | null;
  waba_id: string | null;
  display_phone_number: string | null;
  /** true when a token is stored (the token itself is server-only) */
  has_access_token: boolean;
  connected: boolean;
  ai_enabled: boolean;
  ai_system_prompt: string;
  ai_model: string;
  ai_debounce_seconds: number;
  ai_max_history: number;
  ai_business_context: string | null;
  profile_photo_url: string | null;
  website_url: string | null;
  timezone: string | null;
  social_links: { label: string; url: string }[] | null;
  catalog: { name: string; price?: string; url?: string; image_url?: string }[] | null;
  business_name: string | null;
  business_hours: { day: number; enabled: boolean; open: string; close: string }[] | null;
};
