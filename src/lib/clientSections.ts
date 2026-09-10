import type { ClientCapabilities } from "@/hooks/use-client-capabilities";

export type SectionKey =
  | "plan"
  | "instagram"
  | "meta-ads"
  | "automatizacion"
  | "sitio"
  | "bandeja"
  | "leads"
  | "facturacion"
  | "analytics";

export interface SectionDef {
  key: SectionKey;
  label: string;
  /** Returns null when active, or the missing prerequisite when locked. */
  lockedReason: (c: ClientCapabilities) => string | null;
}

export const CLIENT_SECTIONS: SectionDef[] = [
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
  {
    key: "analytics",
    label: "Analítica",
    lockedReason: (c) =>
      c.has_ad_data || c.has_outcomes
        ? null
        : "Falta la primera ingesta de anuncios o marcar conversaciones",
  },
];

export function activeSectionCount(caps: ClientCapabilities): number {
  return CLIENT_SECTIONS.filter((s) => s.lockedReason(caps) === null).length;
}
