import {
  CalendarDays,
  Flag,
  Globe,
  Images,
  Instagram,
  LayoutDashboard,
  MessageCircle,
  Receipt,
  Scale,
  Search,
  UserPlus,
} from "lucide-react";
import type { ComponentType } from "react";
import { MetaIcon } from "@/components/icons/MetaIcon";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * Secciones del panel del cliente (/mi), con el mismo orden y nombres que el
 * panel izquierdo de la agencia. Las rutas NO llevan clientId: el cliente sale
 * siempre de la sesión (user_client_id() vía client_self).
 *
 * "ready": la página ya muestra datos seguros para el cliente (los del portal).
 * "soon": la lectura se abre en la Fase 2; mientras, "Disponible pronto".
 */
export type ClientPanelSectionKey =
  | "plan"
  | "calendario"
  | "archivos"
  | "sitio"
  | "instagram"
  | "whatsapp"
  | "meta-ads"
  | "google-ads"
  | "leads"
  | "facturacion"
  | "legal";

export interface ClientPanelSection {
  key: ClientPanelSectionKey;
  label: string;
  icon: IconComponent;
  status: "ready" | "soon";
}

export const SUMMARY_ICON: IconComponent = LayoutDashboard;

export const CLIENT_PANEL_GROUPS: readonly {
  key: string;
  label: string;
  sections: readonly ClientPanelSection[];
}[] = [
  {
    key: "operacion",
    label: "Operación",
    sections: [
      { key: "plan", label: "Plan", icon: Flag, status: "ready" },
      { key: "calendario", label: "Calendario", icon: CalendarDays, status: "ready" },
      { key: "archivos", label: "Archivos", icon: Images, status: "ready" },
      { key: "sitio", label: "Sitio", icon: Globe, status: "ready" },
    ],
  },
  {
    key: "conexiones",
    label: "Conexiones",
    sections: [
      { key: "instagram", label: "Instagram", icon: Instagram, status: "soon" },
      { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, status: "soon" },
      { key: "meta-ads", label: "Meta Ads", icon: MetaIcon, status: "ready" },
      { key: "google-ads", label: "Google Ads", icon: Search, status: "ready" },
    ],
  },
  {
    key: "negocio",
    label: "Negocio",
    sections: [
      { key: "leads", label: "Leads", icon: UserPlus, status: "soon" },
      { key: "facturacion", label: "Facturación", icon: Receipt, status: "ready" },
      { key: "legal", label: "Legal", icon: Scale, status: "ready" },
    ],
  },
];

export const CLIENT_PANEL_SECTIONS: readonly ClientPanelSection[] = CLIENT_PANEL_GROUPS.flatMap(
  (g) => g.sections,
);

/** Sección "Disponible pronto" por su clave de URL (null si no existe o ya tiene página). */
export function soonSection(key: string): ClientPanelSection | null {
  return CLIENT_PANEL_SECTIONS.find((s) => s.key === key && s.status === "soon") ?? null;
}

/** Ruta de una sección del panel (siempre bajo /mi, nunca rutas de agencia). */
export function sectionHref(key: ClientPanelSectionKey): string {
  return `/mi/${key}`;
}
