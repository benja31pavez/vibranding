/**
 * Temas listos para el multienlace. Todos pasan AA: los textos de botones se
 * calculan con contraste (ver itemVisual), y aquí sólo se eligen combinaciones
 * que se ven bien juntas.
 */
import type { Background, ButtonShape, ButtonStyle, FontKey } from "@/lib/multilinkTheme";

export type MultilinkPreset = {
  key: string;
  label: string;
  theme_color: string;
  theme_mode: "light" | "dark";
  background: Background;
  button_style: ButtonStyle;
  button_shape: ButtonShape;
  font_family: FontKey;
};

export const MULTILINK_PRESETS: MultilinkPreset[] = [
  {
    key: "limpio",
    label: "Limpio",
    theme_color: "#111827",
    theme_mode: "light",
    background: { type: "flat" },
    button_style: "solid",
    button_shape: "rounded",
    font_family: "geometric",
  },
  {
    key: "marca",
    label: "Marca",
    theme_color: "#15803d",
    theme_mode: "light",
    background: { type: "gradient", from: "#15803d", to: "#0e7490", angle: 135 },
    button_style: "soft",
    button_shape: "pill",
    font_family: "geometric",
  },
  {
    key: "natural",
    label: "Natural",
    theme_color: "#3f6212",
    theme_mode: "light",
    background: { type: "solid", color: "#ece6d6" },
    button_style: "outline",
    button_shape: "rounded",
    font_family: "serif",
  },
  {
    key: "dulce",
    label: "Dulce",
    theme_color: "#be185d",
    theme_mode: "light",
    background: { type: "gradient", from: "#fbcfe8", to: "#fde68a", angle: 160 },
    button_style: "solid",
    button_shape: "pill",
    font_family: "rounded",
  },
  {
    key: "noche",
    label: "Noche",
    theme_color: "#38bdf8",
    theme_mode: "dark",
    background: { type: "gradient", from: "#0f172a", to: "#312e81", angle: 160 },
    button_style: "glass",
    button_shape: "pill",
    font_family: "grotesque",
  },
  {
    key: "audaz",
    label: "Audaz",
    theme_color: "#facc15",
    theme_mode: "light",
    background: { type: "solid", color: "#111111" },
    button_style: "hard-shadow",
    button_shape: "square",
    font_family: "grotesque",
  },
];
