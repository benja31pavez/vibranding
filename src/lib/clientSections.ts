import type { ClientCapabilities } from "@/hooks/use-client-capabilities";

export type SectionKey =
  | "plan"
  | "instagram"
  | "meta-ads"
  | "google-ads"
  | "automatizacion"
  | "sitio"
  | "bandeja"
  | "leads"
  | "facturacion"
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
 * Se ocultan porque no forman parte de los planes que vende VIBRANDING
 * (Marca + Web, Plan Contenido, Plan Crecimiento) y solo agregan ruido:
 *  - "automatizacion": automatización avanzada de Instagram.
 *  - "analytics": embudo/CAC/ROAS basado en outcomes y backfill de conversaciones.
 *
 * Las rutas siguen existiendo (se puede entrar por URL); solo desaparecen del menú.
 *
 * Para reactivar una sección: quítala de este Set. Para mostrar todas: `new Set()`.
 */
export const HIDDEN_SECTIONS: ReadonlySet<SectionKey> = new Set<SectionKey>([
  "automatizacion",
  "analytics",
]);

/** Todas las secciones definidas, incluidas las ocultas. */
export const ALL_CLIENT_SECTIONS: SectionDef[] = [
  { key: "plan", label: "Plan", lockedReason: () => null },
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
  // Siempre abierta: la pantalla explica qué falta (variables o conexión).
  { key: "google-ads", label: "Google Ads", lockedReason: () => null },
  {
    key: "automatizacion",
    label: "Automatización",
    lockedReason: (c) =>
      c.has_instagram ? null : "Falta vincular una cuenta de Instagram en Meta",
  },
  { key: "sitio", label: "Sitio", lockedReason: () => null },
  {
    key: "bandeja",
    label: "WhatsApp",
    lockedReason: (c) => (c.has_whatsapp ? null : "Falta conectar WhatsApp"),
  },
  { key: "leads", label: "Leads", lockedReason: () => null },
  { key: "facturacion", label: "Facturación", lockedReason: () => null },
  { key: "legal", label: "Legal", lockedReason: () => null },
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
