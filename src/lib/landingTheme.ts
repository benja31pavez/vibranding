/** Presentation layer for the public landing page. Additive: no existing field changes. */
import {
  Scissors,
  Sparkles,
  Heart,
  Star,
  Camera,
  Coffee,
  Utensils,
  Dumbbell,
  Car,
  Home,
  Wrench,
  Stethoscope,
  GraduationCap,
  Briefcase,
  ShoppingBag,
  Truck,
  PawPrint,
  Leaf,
  Palette,
  Music,
  Laptop,
  Phone,
  Gift,
  Shield,
  Clock,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export type LandingTemplate = "classic" | "centered" | "fullbleed";
export type HeroAspect = "square" | "portrait" | "landscape";

export const TEMPLATE_LABEL: Record<LandingTemplate, string> = {
  classic: "Hero dividido (clásico)",
  centered: "Hero centrado",
  fullbleed: "Imagen a sangre completa",
};

export const HERO_ASPECT_LABEL: Record<HeroAspect, string> = {
  square: "Cuadrada (1:1)",
  portrait: "Vertical (4:5)",
  landscape: "Horizontal (16:9)",
};

export const HERO_ASPECT_CSS: Record<HeroAspect, string> = {
  square: "1 / 1",
  portrait: "4 / 5",
  landscape: "16 / 9",
};

export function templateKey(raw: string | null | undefined): LandingTemplate {
  return raw && raw in TEMPLATE_LABEL ? (raw as LandingTemplate) : "classic";
}

export function heroAspectKey(raw: string | null | undefined): HeroAspect {
  return raw && raw in HERO_ASPECT_LABEL ? (raw as HeroAspect) : "square";
}

/* ---------------- icons ---------------- */

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  scissors: Scissors,
  sparkles: Sparkles,
  heart: Heart,
  star: Star,
  camera: Camera,
  coffee: Coffee,
  utensils: Utensils,
  dumbbell: Dumbbell,
  car: Car,
  home: Home,
  wrench: Wrench,
  stethoscope: Stethoscope,
  education: GraduationCap,
  briefcase: Briefcase,
  bag: ShoppingBag,
  truck: Truck,
  pet: PawPrint,
  leaf: Leaf,
  palette: Palette,
  music: Music,
  laptop: Laptop,
  phone: Phone,
  gift: Gift,
  shield: Shield,
  clock: Clock,
  pin: MapPin,
};

export const SERVICE_ICON_KEYS = Object.keys(SERVICE_ICONS);

export function serviceIcon(key: string | null | undefined): LucideIcon | null {
  return key && key in SERVICE_ICONS ? SERVICE_ICONS[key] : null;
}

/* ---------------- colour maths ---------------- */

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function relLuminance(rgb: [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb.map(f) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a),
    rb = parseHex(b);
  if (!ra || !rb) return 21;
  const la = relLuminance(ra),
    lb = relLuminance(rb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return toHex([
    rgb[0] + (target[0] - rgb[0]) * amount,
    rgb[1] + (target[1] - rgb[1]) * amount,
    rgb[2] + (target[2] - rgb[2]) * amount,
  ]);
}

export const darken = (hex: string, amount: number) => mix(hex, [0, 0, 0], amount);
export const lighten = (hex: string, amount: number) => mix(hex, [255, 255, 255], amount);

/** Darken (or lighten on dark backgrounds) until the pair clears WCAG AA for large text. */
export function readableOn(color: string, background: string, min = 4.5): string {
  if (!parseHex(color)) return color;
  const bgDark = relLuminance(parseHex(background) ?? [255, 255, 255]) < 0.5;
  let out = color;
  for (let i = 1; i <= 10; i++) {
    if (contrastRatio(out, background) >= min) return out;
    out = bgDark ? lighten(color, i * 0.09) : darken(color, i * 0.09);
  }
  return contrastRatio(out, background) >= min ? out : bgDark ? "#f5f5f5" : "#111827";
}

/** Blanco o casi negro: el que tenga más contraste sobre `bg` (texto de botones). */
export function bestOn(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#0a0a0a") ? "#ffffff" : "#0a0a0a";
}

export type LandingPalette = {
  isDark: boolean;
  brand: string;
  /** Brand colour adjusted so it stays legible as text. */
  brandText: string;
  onBrand: string;
  background: string;
  surface: string;
  /** Soft brand-tinted band for alternating sections. */
  tint: string;
  /** Stronger brand band for full-bleed sections. */
  band: string;
  onBand: string;
  border: string;
  text: string;
  muted: string;
  /** True when the raw brand colour fails contrast as text on the background. */
  lowContrast: boolean;
  contrast: number;
};

export function landingPalette(rawColor: string | null | undefined, dark: boolean): LandingPalette {
  const brand = parseHex(rawColor ?? "") ? (rawColor as string) : "#6366f1";
  const background = dark ? "#0b0b0f" : "#ffffff";
  const contrast = contrastRatio(brand, background);
  return {
    isDark: dark,
    brand,
    brandText: readableOn(brand, background),
    onBrand: bestOn(brand),
    background,
    surface: dark ? "#15151c" : "#ffffff",
    tint: dark ? withAlpha(brand, 0.12) : lighten(brand, 0.92),
    band: dark ? darken(brand, 0.45) : brand,
    onBand: bestOn(dark ? darken(brand, 0.45) : brand),
    border: dark ? withAlpha(brand, 0.28) : withAlpha(brand, 0.22),
    text: dark ? "#f4f4f5" : "#111827",
    muted: dark ? "#a1a1aa" : "#52525b",
    lowContrast: contrast < 4.5,
    contrast,
  };
}

/* ---------------- optional sections ---------------- */

export type Testimonial = { name: string; role?: string; quote: string; photo_url?: string | null };
export type FaqItem = { question: string; answer: string };
export type OpeningHour = { day: number; closed?: boolean; from?: string; to?: string };
export type LandingLocation = {
  address?: string;
  /** Comuna principal (p. ej. "Providencia"): alimenta el JSON-LD LocalBusiness. */
  comuna?: string;
  /** Región (p. ej. "Región Metropolitana"). */
  region?: string;
  /** Comunas donde atiende el negocio (servicios a domicilio). */
  comunas?: string[];
  map_embed_url?: string;
  hours?: OpeningHour[];
};
export type LandingFooter = {
  email?: string;
  phone?: string;
  address?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  legal?: { label: string; url: string }[];
};

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function defaultHours(): OpeningHour[] {
  return WEEKDAYS.map((_, i) => ({ day: i, closed: i > 4, from: "09:00", to: "18:00" }));
}

export function asArray<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export function asObject<T extends object>(raw: unknown): T {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as T) : ({} as T);
}

/* ---------------- section ordering ---------------- */

export const LANDING_SECTION_KEYS = [
  "servicios",
  "galeria",
  "whatsapp",
  "testimonios",
  "ubicacion",
  "faq",
  "contacto",
] as const;

export type LandingSectionKey = (typeof LANDING_SECTION_KEYS)[number];

export const LANDING_SECTION_LABEL: Record<LandingSectionKey, string> = {
  servicios: "Servicios",
  galeria: "Galería y antes/después",
  whatsapp: "Llamado a WhatsApp",
  testimonios: "Testimonios",
  ubicacion: "Ubicación, comunas y horarios",
  faq: "Preguntas frecuentes",
  contacto: "Formulario de contacto",
};

/**
 * Servicios y galería no tienen columna booleana propia: se ocultan guardando
 * "hidden:<clave>" dentro de section_order (text[]), sin migraciones.
 */
const HIDDEN_PREFIX = "hidden:";
export const HIDEABLE_BY_ORDER: readonly LandingSectionKey[] = ["servicios", "galeria"];

function isSectionKey(k: unknown): k is LandingSectionKey {
  return (LANDING_SECTION_KEYS as readonly string[]).includes(k as string);
}

/** Keeps existing landings on the hardcoded order when section_order is null. */
export function resolveSectionOrder(raw: unknown): LandingSectionKey[] {
  const list = Array.isArray(raw) ? raw.filter(isSectionKey) : [];
  const seen = new Set(list);
  return [...list, ...LANDING_SECTION_KEYS.filter((k) => !seen.has(k))];
}

/** Secciones ocultadas manualmente (sólo servicios / galería). */
export function resolveHiddenSections(raw: unknown): LandingSectionKey[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k): k is string => typeof k === "string" && k.startsWith(HIDDEN_PREFIX))
    .map((k) => k.slice(HIDDEN_PREFIX.length))
    .filter(isSectionKey)
    .filter((k) => HIDEABLE_BY_ORDER.includes(k));
}

export function serializeSectionOrder(
  order: LandingSectionKey[],
  hidden: LandingSectionKey[],
): string[] {
  return [...order, ...hidden.map((k) => `${HIDDEN_PREFIX}${k}`)];
}

/* ---------------- gallery ---------------- */

export type GalleryItem = {
  url: string;
  caption?: string;
  alt?: string;
  /** Si existe, el ítem se muestra como comparación antes / después (url = después). */
  before_url?: string | null;
};
