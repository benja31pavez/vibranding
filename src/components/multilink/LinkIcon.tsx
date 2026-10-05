import {
  Facebook,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Star,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { LinkKind } from "@/lib/site/linkKind";

export const LINK_ICON: Record<LinkKind, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  tiktok: Music2,
  facebook: Facebook,
  youtube: Youtube,
  maps: MapPin,
  reviews: Star,
  email: Mail,
  phone: Phone,
  website: Globe,
};

/** Ícono automático según el destino del enlace (decorativo: el texto del botón ya lo describe). */
export function LinkIcon({ kind, className = "h-5 w-5" }: { kind: LinkKind; className?: string }) {
  const Icon = LINK_ICON[kind];
  return <Icon className={className} aria-hidden="true" />;
}
