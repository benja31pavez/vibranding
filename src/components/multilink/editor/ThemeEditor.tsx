import { useEffect, type ReactNode } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploadButton } from "@/components/site/fields";
import type { Multilink } from "@/lib/multilink";
import {
  BUTTON_SHAPE_LABEL,
  BUTTON_STYLE_LABEL,
  fontHref,
  FONTS,
  itemVisual,
  parseBackground,
  SHAPE_RADIUS,
  surfaceTheme,
  type Background,
  type ButtonShape,
  type ButtonStyle,
  type FontKey,
} from "@/lib/multilinkTheme";
import { MULTILINK_PRESETS, type MultilinkPreset } from "@/lib/site/multilinkPresets";
import { cn } from "@/lib/utils";

/** Gradiente de marca de Vibranding (azul → magenta), en hex para el multienlace. */
const VIBRANDING_PRESET: MultilinkPreset = {
  key: "vibranding",
  label: "Vibranding",
  theme_color: "#2f6fe4",
  theme_mode: "light",
  background: { type: "gradient", from: "#2f7bf2", to: "#d63fae", angle: 135 },
  button_style: "solid",
  button_shape: "pill",
  font_family: "geometric",
};

const MAX_PRESETS = 6;

const BACKGROUND_LABEL: Record<Background["type"], string> = {
  flat: "Color de marca",
  solid: "Color sólido",
  gradient: "Degradado",
  image: "Imagen",
};

/** Temas con los colores del cliente (onboarding) primero, luego Vibranding y los genéricos. */
function themePresets(brandColors: string[]): MultilinkPreset[] {
  const [main, second] = brandColors;
  const client: MultilinkPreset[] = main
    ? [
        {
          key: "cliente",
          label: "Marca",
          theme_color: main,
          theme_mode: "light",
          background: second
            ? { type: "gradient", from: main, to: second, angle: 135 }
            : { type: "flat" },
          button_style: "solid",
          button_shape: "pill",
          font_family: "geometric",
        },
        {
          key: "cliente-noche",
          label: "Marca noche",
          theme_color: second ?? main,
          theme_mode: "dark",
          background: { type: "gradient", from: "#0f172a", to: main, angle: 160 },
          button_style: "glass",
          button_shape: "pill",
          font_family: "grotesque",
        },
      ]
    : [];
  const generic = MULTILINK_PRESETS.filter((p) => !(main && p.key === "marca"));
  return [...client, VIBRANDING_PRESET, ...generic].slice(0, MAX_PRESETS);
}

function presetMatches(ml: Multilink, p: MultilinkPreset): boolean {
  return (
    ml.button_style === p.button_style &&
    ml.button_shape === p.button_shape &&
    ml.font_family === p.font_family &&
    ml.theme_mode === p.theme_mode &&
    JSON.stringify(parseBackground(ml.background)) === JSON.stringify(p.background)
  );
}

function coverCss(bg: Background, accent: string): string {
  if (bg.type === "gradient") return `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  if (bg.type === "solid") return bg.color;
  if (bg.type === "image" && bg.url) return `url("${bg.url}") center / cover`;
  return accent;
}

/** Mini teléfono con la portada, el avatar y tres botones en el estilo del tema. */
function PresetSwatch({ preset }: { preset: MultilinkPreset }) {
  const theme = surfaceTheme(preset.theme_mode, { type: "flat" });
  const panel = theme.isDark ? "#0e0e11" : "#fbfaf8";
  const visual = itemVisual(preset.button_style, preset.button_shape, preset.theme_color, theme);
  return (
    <span
      className="block overflow-hidden rounded-lg border border-border-subtle"
      aria-hidden="true"
    >
      <span
        className="block h-7"
        style={{ background: coverCss(preset.background, preset.theme_color) }}
      />
      <span className="relative block space-y-1 px-2 pb-2 pt-3" style={{ background: panel }}>
        <span
          className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2"
          style={{ background: preset.theme_color, borderColor: panel }}
        />
        {[1, 0.8, 0.8].map((o, k) => (
          <span
            key={k}
            className="block h-2.5"
            style={{
              ...visual.style,
              borderWidth: visual.style.border ? 1 : undefined,
              boxShadow: undefined,
              opacity: o,
            }}
          />
        ))}
      </span>
    </span>
  );
}

/** Botón de opción con estado elegido claro (aria-pressed + anillo + check). */
function Choice({
  active,
  onClick,
  label,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex flex-col items-stretch gap-1.5 rounded-app-md border bg-surface p-1.5 text-left text-xs transition-[border-color,box-shadow,transform] duration-200 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:scale-[0.98]",
        active ? "border-primary shadow-app-md ring-1 ring-primary" : "border-border-subtle",
        className,
      )}
    >
      {children}
      <span className="px-0.5 font-medium">{label}</span>
      {active && (
        <Check
          className="absolute right-1.5 top-1.5 h-4 w-4 rounded-full bg-primary p-0.5 text-primary-foreground"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Las tipografías se ven en su propia letra: se cargan una vez en el documento del editor. */
function useEditorFonts() {
  useEffect(() => {
    for (const key of Object.keys(FONTS) as FontKey[]) {
      const href = fontHref(key);
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.mlFont = key;
      document.head.appendChild(link);
    }
  }, []);
}

export function ThemeEditor({
  ml,
  onChange,
  brandColors = [],
}: {
  ml: Multilink;
  onChange: (next: Multilink) => void;
  brandColors?: string[];
}) {
  useEditorFonts();
  const presets = themePresets(brandColors);
  const bg = parseBackground(ml.background);
  const theme = surfaceTheme(ml.theme_mode, { type: "flat" });
  const setBg = (next: Background) => onChange({ ...ml, background: next });
  const applyPreset = (p: MultilinkPreset) =>
    onChange({
      ...ml,
      theme_color: p.theme_color,
      theme_mode: p.theme_mode,
      background: p.background,
      button_style: p.button_style,
      button_shape: p.button_shape,
      font_family: p.font_family,
    });
  const pickBackground = (t: Background["type"]) => {
    if (t === bg.type) return;
    if (t === "flat") setBg({ type: "flat" });
    else if (t === "solid") setBg({ type: "solid", color: "#111827" });
    else if (t === "gradient")
      setBg({ type: "gradient", from: ml.theme_color, to: "#0e7490", angle: 135 });
    else setBg({ type: "image", url: null, overlay: 0.45 });
  };

  return (
    <div className="space-y-5">
      <Group title="Temas listos">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {presets.map((p) => (
            <li key={p.key}>
              <Choice
                active={presetMatches(ml, p)}
                onClick={() => applyPreset(p)}
                label={p.label}
                className="w-full"
              >
                <PresetSwatch preset={p} />
              </Choice>
            </li>
          ))}
        </ul>
      </Group>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <Group title="Color de marca">
          <div className="flex flex-wrap items-center gap-2">
            {brandColors.map((c) => {
              const active = ml.theme_color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...ml, theme_color: c })}
                  aria-label={`Usar el color del cliente ${c}`}
                  aria-pressed={active}
                  title={c}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 border-surface shadow-app-xs ring-offset-2 ring-offset-surface transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "ring-2 ring-foreground"
                      : "ring-1 ring-border-subtle hover:ring-border-strong",
                  )}
                  style={{ background: c }}
                />
              );
            })}
            <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border border-border-strong shadow-app-xs focus-within:ring-2 focus-within:ring-ring">
              <span className="sr-only">Elegir otro color de marca</span>
              <Input
                type="color"
                value={ml.theme_color}
                onChange={(e) => onChange({ ...ml, theme_color: e.target.value })}
                className="absolute -inset-2 h-14 w-14 cursor-pointer border-0 p-0"
              />
            </label>
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {ml.theme_color}
            </span>
          </div>
        </Group>
        <Group title="Modo">
          <div className="flex w-fit gap-1 rounded-app-md bg-muted p-1">
            {(
              [
                ["light", "Claro", Sun],
                ["dark", "Oscuro", Moon],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={ml.theme_mode === mode}
                onClick={() => onChange({ ...ml, theme_mode: mode })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-app-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  ml.theme_mode === mode
                    ? "bg-background text-foreground shadow-app-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </Group>
      </div>

      <details className="group rounded-app-lg border border-border-subtle bg-surface-2/40 p-3 [&[open]]:pb-4">
        <summary className="cursor-pointer select-none rounded-app-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Ajustes finos de estilo
          <span className="ml-2 font-normal text-muted-foreground">
            botones, forma, tipografía y portada
          </span>
        </summary>
        <div className="mt-4 space-y-5">
          <Group title="Botones">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(Object.keys(BUTTON_STYLE_LABEL) as ButtonStyle[]).map((k) => {
                const v = itemVisual(k, "rounded", ml.theme_color, theme);
                return (
                  <Choice
                    key={k}
                    active={ml.button_style === k}
                    onClick={() => onChange({ ...ml, button_style: k })}
                    label={BUTTON_STYLE_LABEL[k]}
                  >
                    <span
                      className="grid h-12 place-items-center rounded-app-sm px-2"
                      style={{ background: theme.isDark ? "#0e0e11" : "#fbfaf8" }}
                      aria-hidden="true"
                    >
                      <span
                        className="block h-5 w-full"
                        style={{ ...v.style, borderRadius: "0.4rem" }}
                      />
                    </span>
                  </Choice>
                );
              })}
            </div>
          </Group>
          <div className="grid gap-5 sm:grid-cols-2">
            <Group title="Forma">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(BUTTON_SHAPE_LABEL) as ButtonShape[]).map((k) => (
                  <Choice
                    key={k}
                    active={ml.button_shape === k}
                    onClick={() => onChange({ ...ml, button_shape: k })}
                    label={BUTTON_SHAPE_LABEL[k]}
                  >
                    <span className="grid h-10 place-items-center px-2" aria-hidden="true">
                      <span
                        className="block h-5 w-full border-2 border-foreground/70"
                        style={{ borderRadius: SHAPE_RADIUS[k] }}
                      />
                    </span>
                  </Choice>
                ))}
              </div>
            </Group>
            <Group title="Tipografía">
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(FONTS) as FontKey[]).map((k) => (
                  <Choice
                    key={k}
                    active={ml.font_family === k}
                    onClick={() => onChange({ ...ml, font_family: k })}
                    label={FONTS[k].label.split(" (")[0]}
                  >
                    <span
                      className="grid h-10 place-items-center text-2xl font-semibold"
                      style={{ fontFamily: FONTS[k].family }}
                      title={FONTS[k].label}
                      aria-hidden="true"
                    >
                      Aa
                    </span>
                  </Choice>
                ))}
              </div>
            </Group>
          </div>
          <Group title="Fondo de la portada">
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(BACKGROUND_LABEL) as Background["type"][]).map((t) => (
                <Choice
                  key={t}
                  active={bg.type === t}
                  onClick={() => pickBackground(t)}
                  label={BACKGROUND_LABEL[t]}
                >
                  <span
                    className="block h-8 rounded-app-sm border border-border-subtle"
                    style={{
                      background:
                        t === bg.type
                          ? coverCss(bg, ml.theme_color)
                          : t === "gradient"
                            ? `linear-gradient(135deg, ${ml.theme_color}, #0e7490)`
                            : t === "solid"
                              ? "#111827"
                              : t === "image"
                                ? "repeating-linear-gradient(45deg, var(--muted), var(--muted) 6px, transparent 6px, transparent 12px)"
                                : ml.theme_color,
                    }}
                    aria-hidden="true"
                  />
                </Choice>
              ))}
            </div>
            <BackgroundControls bg={bg} setBg={setBg} clientId={ml.client_id} />
          </Group>
        </div>
      </details>
    </div>
  );
}

function BackgroundControls({
  bg,
  setBg,
  clientId,
}: {
  bg: Background;
  setBg: (b: Background) => void;
  clientId: string;
}) {
  if (bg.type === "solid") {
    return (
      <Input
        type="color"
        aria-label="Color de fondo"
        value={bg.color}
        onChange={(e) => setBg({ ...bg, color: e.target.value })}
        className="h-9 w-16 p-1"
      />
    );
  }
  if (bg.type === "gradient") {
    return (
      <div className="flex flex-wrap items-end gap-3">
        <Input
          type="color"
          aria-label="Color inicial"
          value={bg.from}
          onChange={(e) => setBg({ ...bg, from: e.target.value })}
          className="h-9 w-16 p-1"
        />
        <Input
          type="color"
          aria-label="Color final"
          value={bg.to}
          onChange={(e) => setBg({ ...bg, to: e.target.value })}
          className="h-9 w-16 p-1"
        />
        <label className="min-w-[140px] flex-1 text-xs text-muted-foreground">
          Ángulo: {bg.angle}°
          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={bg.angle}
            onChange={(e) => setBg({ ...bg, angle: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </label>
      </div>
    );
  }
  if (bg.type === "image") return <ImageBackground bg={bg} setBg={setBg} clientId={clientId} />;
  return null;
}

function ImageBackground({
  bg,
  setBg,
  clientId,
}: {
  bg: Extract<Background, { type: "image" }>;
  setBg: (b: Background) => void;
  clientId: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {bg.url && (
          <img
            src={bg.url}
            alt=""
            width={80}
            height={56}
            className="h-14 w-20 rounded-app-md object-cover"
          />
        )}
        <ImageUploadButton
          clientId={clientId}
          label="Subir imagen"
          onUploaded={([url]) => setBg({ ...bg, url })}
        />
        {bg.url && (
          <Button size="sm" variant="ghost" onClick={() => setBg({ ...bg, url: null })}>
            Quitar
          </Button>
        )}
      </div>
      <label className="block text-xs text-muted-foreground">
        Oscurecer para legibilidad: {Math.round(bg.overlay * 100)}%
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={Math.round(bg.overlay * 100)}
          onChange={(e) => setBg({ ...bg, overlay: Number(e.target.value) / 100 })}
          className="w-full accent-primary"
        />
      </label>
    </div>
  );
}
