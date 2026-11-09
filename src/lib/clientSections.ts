import type { ClientCapabilities } from "@/hooks/use-client-capabilities";

export type SectionKey =
  | "plan"
  | "calendario"
  | "archivos"
  // Mantenido como SectionKey para no romper tipos en componentes/hooks; se oculta del menú
  // y la ruta antigua redirige a /canales?tab=instagram.
  | "instagram"
  // Mantenido como SectionKey; se oculta del menú y la ruta antigua redirige a /anuncios?tab=meta.
  | "meta-ads"
  // Mantenido como SectionKey; se oculta del menú y la ruta antigua redirige a /anuncios?tab=google.
  | "google-ads"
  | "automatizacion"
  | "sitio"
  // Mantenido como SectionKey; se oculta del menú y la ruta antigua redirige a /canales?tab=whatsapp.
  | "bandeja"
  | "canales"
  | "anuncios"
  | "leads"
  | "facturacion"
  | "personal"
  | "legal"
  | "analytics";

export interface SectionDef {
  key: SectionKey;
  label: string;
  /** Returns null when active, or the missing prerequisite when locked. */
  lockedReason: (c: ClientCapabilities) => string | null;
}

/**
 * Secciones ocultas del menú del cliente (feature flag).
 *
 * Instagram, WhatsApp (bandeja), Meta Ads y Google Ads ahora viven como subpestañas
 * dentro de Canales y Anuncios respectivamente; sus rutas antiguas siguen funcionando
 * (redirigen con `beforeLoad`), pero desaparecen del menú.
 *
 * Automatización y Analítica se mantienen ocultas por no formar parte de los planes
 * vendidos hoy.
 *
 * Para reactivar una sección: quítala de este Set. Para mostrar todas: `new Set()`.
 */
export const HIDDEN_SECTIONS: ReadonlySet<SectionKey> = new Set<SectionKey>([
  "instagram",
  "meta-ads",
  "google-ads",
  "bandeja",
  "automatizacion",
  "analytics",
]);

/** Todas las secciones definidas, incluidas las ocultas. */
export const ALL_CLIENT_SECTIONS: SectionDef[] = [
  { key: "plan", label: "Proyectos", lockedReason: () => null },
  { key: "calendario", label: "Calendario", lockedReason: () => null },
  { key: "archivos", label: "Archivos", lockedReason: () => null },
  { key: "sitio", label: "Sitio", lockedReason: () => null },
  { key: "canales", label: "Canales", lockedReason: () => null },
  { key: "anuncios", label: "Anuncios", lockedReason: () => null },
  { key: "leads", label: "Leads", lockedReason: () => null },
  { key: "facturacion", label: "Finanzas", lockedReason: () => null },
  { key: "legal", label: "Legal", lockedReason: () => null },
  { key: "personal", label: "Personal", lockedReason: () => null },
  // Secciones ocultas (mantenidas para que las rutas y tipos sigan funcionando).
  {
    key: "instagram",
    label: "Instagram",
    lockedReason: (c) =>
      c.has_instagram ? null : "Falta vincular una cuenta de Instagram en Meta",
  },
  {
    key: "meta-ads",
    label: "Meta Ads",
    lockedReason: (c) => (c.has_ad_account ? null : "Falta asignar una cuenta publicitaria"),
  },
  { key: "google-ads", label: "Google Ads", lockedReason: () => null },
  {
    key: "automatizacion",
    label: "Automatización",
    lockedReason: (c) =>
      c.has_instagram ? null : "Falta vincular una cuenta de Instagram en Meta",
  },
  {
    key: "bandeja",
    label: "WhatsApp",
    lockedReason: (c) => (c.has_whatsapp ? null : "Falta conectar WhatsApp"),
  },
  {
    key: "analytics",
    label: "Analítica",
    lockedReason: (c) =>
      c.has_ad_data || c.has_outcomes
        ? null
        : "Falta la primera ingesta de anuncios o marcar conversaciones",
  },
];

/** Secciones visibles en el menú del cliente. */
export const CLIENT_SECTIONS: SectionDef[] = ALL_CLIENT_SECTIONS.filter(
  (s) => !HIDDEN_SECTIONS.has(s.key),
);
