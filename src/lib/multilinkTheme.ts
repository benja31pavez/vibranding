/** Presentation layer for the public multilink page. No data-model changes. */
import { bestOn, readableOn } from "@/lib/landingTheme";

export type ButtonStyle = "solid" | "outline" | "soft" | "hard-shadow" | "glass";
export type ButtonShape = "rounded" | "pill" | "square";
export type FontKey = "geometric" | "grotesque" | "serif" | "rounded";

export type Background =
  | { type: "flat" }
  | { type: "solid"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number }
  | { type: "image"; url: string | null; overlay: number };

export const BUTTON_STYLE_LABEL: Record<ButtonStyle, string> = {
  solid: "Sólido",
  outline: "Contorno",
  soft: "Suave",
  "hard-shadow": "Sombra dura",
  glass: "Vidrio",
};

export const BUTTON_SHAPE_LABEL: Record<ButtonShape, string> = {
  rounded: "Redondeado",
  pill: "Píldora",
  square: "Cuadrado",
};

export const FONTS: Record<FontKey, { label: string; family: string; googleFamily: string }> = {
  geometric: {
    label: "Geométrica (Poppins)",
    family: "'Poppins', system-ui, sans-serif",
    googleFamily: "Poppins:wght@400;500;600;700",
  },
  grotesque: {
    label: "Grotesca (Space Grotesk)",
    family: "'Space Grotesk', system-ui, sans-serif",
    googleFamily: "Space+Grotesk:wght@400;500;600;700",
  },
  serif: {
    label: "Serif (Playfair Display)",
    family: "'Playfair Display', Georgia, serif",
    googleFamily: "Playfair+Display:wght@400;500;600;700",
  },
  rounded: {
    label: "Redondeada (Nunito)",
    family: "'Nunito', system-ui, sans-serif",
    googleFamily: "Nunito:wght@400;500;600;700",
  },
};

export function fontKey(raw: string | null | undefined): FontKey {
  return raw && raw in FONTS ? (raw as FontKey) : "geometric";
}

export function fontHref(key: FontKey): string {
  return `https://fonts.googleapis.com/css2?family=${FONTS[key].googleFamily}&display=swap`;
}

export function buttonStyleKey(raw: string | null | undefined): ButtonStyle {
  return raw && raw in BUTTON_STYLE_LABEL ? (raw as ButtonStyle) : "solid";
}

export function buttonShapeKey(raw: string | null | undefined): ButtonShape {
  return raw && raw in BUTTON_SHAPE_LABEL ? (raw as ButtonShape) : "rounded";
}

export function parseBackground(raw: unknown): Background {
  const b = (raw ?? null) as any;
  if (!b || typeof b !== "object") return { type: "flat" };
  if (b.type === "solid" && typeof b.color === "string") return { type: "solid", color: b.color };
  if (b.type === "gradient")
    return {
      type: "gradient",
      from: typeof b.from === "string" ? b.from : "#6d28d9",
      to: typeof b.to === "string" ? b.to : "#db2777",
      angle: Number.isFinite(b.angle) ? Number(b.angle) : 160,
    };
  if (b.type === "image")
    return {
      type: "image",
      url: typeof b.url === "string" ? b.url : null,
      overlay: Number.isFinite(b.overlay) ? Number(b.overlay) : 0.45,
    };
  return { type: "flat" };
}

export const SHAPE_RADIUS: Record<ButtonShape, string> = {
  rounded: "0.85rem",
  pill: "999px",
  square: "0.15rem",
};

/** #rrggbb -> rgba() with the given alpha. Falls back to the raw value. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Rough luminance test so text stays legible on any accent colour. */
export function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
}

export type SurfaceTheme = {
  /** CSS background for the page shell. */
  background: string;
  /** Base text colour. */
  color: string;
  isDark: boolean;
  /** Optional overlay layer for image backgrounds. */
  overlay: string | null;
  imageUrl: string | null;
};

export function surfaceTheme(mode: string, bg: Background): SurfaceTheme {
  const isDark = mode === "dark";
  const base = {
    color: isDark ? "#fafafa" : "#0a0a0a",
    isDark,
    overlay: null as string | null,
    imageUrl: null as string | null,
  };
  switch (bg.type) {
    case "solid":
      return {
        ...base,
        background: bg.color,
        color: isLight(bg.color) ? "#0a0a0a" : "#fafafa",
        isDark: !isLight(bg.color),
      };
    case "gradient":
      return {
        ...base,
        background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`,
        color: "#fafafa",
        isDark: true,
      };
    case "image":
      return {
        ...base,
        background: isDark ? "#0a0a0a" : "#fafafa",
        color: "#fafafa",
        isDark: true,
        imageUrl: bg.url,
        overlay: `rgba(0,0,0,${Math.min(Math.max(bg.overlay, 0), 0.9)})`,
      };
    default:
      return { ...base, background: isDark ? "#0a0a0a" : "#fafafa" };
  }
}

export type ItemVisual = {
  className: string;
  style: React.CSSProperties;
};

/** One coherent look for every non-featured item. */
export function itemVisual(
  style: ButtonStyle,
  shape: ButtonShape,
  accent: string,
  theme: SurfaceTheme,
): ItemVisual {
  const radius = SHAPE_RADIUS[shape];
  // Texto de botón siempre con contraste AA (antes el blanco sobre colores medios no llegaba a 4.5:1).
  const onAccent = bestOn(accent);
  const ink = theme.isDark ? "#fafafa" : "#0a0a0a";
  switch (style) {
    case "outline":
      return {
        className: "transition hover:scale-[1.02]",
        style: {
          borderRadius: radius,
          border: `2px solid ${accent}`,
          color: theme.color,
          background: "transparent",
        },
      };
    case "soft":
      return {
        className: "transition hover:scale-[1.02]",
        style: {
          borderRadius: radius,
          background: withAlpha(accent, theme.isDark ? 0.22 : 0.14),
          color: theme.isDark ? "#fafafa" : readableOn(accent, "#f1efe9"),
        },
      };
    case "hard-shadow":
      return {
        className: "transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
        style: {
          borderRadius: radius,
          background: accent,
          color: onAccent,
          border: `2px solid ${ink}`,
          boxShadow: `5px 5px 0 0 ${ink}`,
        },
      };
    case "glass":
      return {
        className: "backdrop-blur-md transition hover:scale-[1.02]",
        style: {
          borderRadius: radius,
          background: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.55)",
          border: `1px solid ${withAlpha(accent, 0.45)}`,
          color: theme.color,
        },
      };
    default:
      return {
        className: "transition hover:scale-[1.02]",
        style: { borderRadius: radius, background: accent, color: onAccent },
      };
  }
}

/** Fallback avatar surface that contrasts with the active background. */
export function avatarFallbackStyle(theme: SurfaceTheme, accent: string): React.CSSProperties {
  return {
    background: theme.isDark ? "rgba(255,255,255,0.16)" : "rgba(10,10,10,0.08)",
    color: theme.color,
    border: `2px solid ${withAlpha(accent, 0.5)}`,
  };
}
