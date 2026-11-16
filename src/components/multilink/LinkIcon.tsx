import { Globe, Instagram, Mail, MapPin, Phone, Star, type LucideIcon } from "lucide-react";
import type { LinkKind } from "@/lib/site/linkKind";
import { BRAND_COLOR, BrandIcon, isBrandGlyph } from "@/components/multilink/BrandIcon";

type GenericKind = Exclude<LinkKind, "whatsapp" | "tiktok" | "facebook" | "youtube">;

/** Íconos de Lucide para lo que no es un logo de marca. */
const GENERIC_ICON: Record<GenericKind, LucideIcon> = {
  instagram: Instagram,
  maps: MapPin,
  reviews: Star,
  email: Mail,
  phone: Phone,
  website: Globe,
};

const EXTRA_COLOR: Partial<Record<LinkKind, string>> = { maps: "#34A853", reviews: "#F4B400" };

/** Color de marca del destino (o null si es genérico): para fichas del editor. */
export function linkKindColor(kind: LinkKind): string | null {
  if (kind in BRAND_COLOR) return BRAND_COLOR[kind as keyof typeof BRAND_COLOR];
  return EXTRA_COLOR[kind] ?? null;
}

/** Ícono automático según el destino del enlace (decorativo: el texto del botón ya lo describe). */
export function LinkIcon({ kind, className = "h-5 w-5" }: { kind: LinkKind; className?: string }) {
  if (isBrandGlyph(kind)) return <BrandIcon brand={kind} className={className} />;
  const Icon = GENERIC_ICON[kind as GenericKind];
  return <Icon className={className} aria-hidden="true" />;
}
