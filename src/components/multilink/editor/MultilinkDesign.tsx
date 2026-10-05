import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, ImageUploadButton } from "@/components/site/fields";
import type { Multilink } from "@/lib/multilink";
import {
  BUTTON_SHAPE_LABEL,
  BUTTON_STYLE_LABEL,
  FONTS,
  parseBackground,
  surfaceTheme,
  type Background,
  type ButtonShape,
  type ButtonStyle,
  type FontKey,
} from "@/lib/multilinkTheme";
import { MULTILINK_PRESETS, type MultilinkPreset } from "@/lib/site/multilinkPresets";
import { slugify } from "@/lib/slug";
import type { ItemErrors } from "@/lib/site/multilinkDraft";

type Props = {
  ml: Multilink;
  onChange: (next: Multilink) => void;
  errors: ItemErrors;
  clientId: string;
  avatarFallback: string | null;
};

const selectClass = "block h-9 w-full rounded-md border bg-background px-2 text-sm";

export function ProfileEditor({ ml, onChange, errors, clientId, avatarFallback }: Props) {
  const avatar = ml.avatar_url ?? avatarFallback;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-xl font-semibold">
          {avatar ? (
            <img
              src={avatar}
              alt="Foto de perfil"
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : (
            ml.title[0] || "?"
          )}
        </div>
        <ImageUploadButton
          clientId={clientId}
          label={avatar ? "Cambiar logo o foto" : "Subir logo o foto"}
          onUploaded={([url]) => onChange({ ...ml, avatar_url: url })}
        />
        {!ml.avatar_url && avatarFallback && (
          <span className="text-xs text-muted-foreground">Usando la foto de Instagram</span>
        )}
      </div>
      <Field label="Nombre" error={errors.title}>
        {(a) => (
          <Input
            {...a}
            value={ml.title}
            maxLength={80}
            onChange={(e) => onChange({ ...ml, title: e.target.value })}
          />
        )}
      </Field>
      <Field
        label="Descripción corta"
        hint={`${(ml.bio ?? "").length}/200 · Qué hace el negocio y dónde`}
      >
        {(a) => (
          <Textarea
            {...a}
            rows={2}
            maxLength={200}
            placeholder="Paisajismo y mantención de jardines en Las Condes y Vitacura"
            value={ml.bio ?? ""}
            onChange={(e) => onChange({ ...ml, bio: e.target.value })}
          />
        )}
      </Field>
      <Field
        label="Dirección del multienlace"
        error={errors.slug}
        hint={`/l/${slugify(ml.slug) || "…"}`}
      >
        {(a) => (
          <Input
            {...a}
            value={ml.slug}
            maxLength={60}
            onChange={(e) => onChange({ ...ml, slug: e.target.value })}
            onBlur={() => onChange({ ...ml, slug: slugify(ml.slug) || ml.slug })}
          />
        )}
      </Field>
    </div>
  );
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

function PresetSwatch({ preset }: { preset: MultilinkPreset }) {
  const bg = preset.background;
  const theme = surfaceTheme(preset.theme_mode, bg);
  const cover =
    bg.type === "gradient"
      ? `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`
      : bg.type === "solid"
        ? bg.color
        : theme.background;
  const panel = theme.isDark ? "#0d0d0f" : "#faf8f5";
  return (
    <span className="block overflow-hidden rounded-lg border" aria-hidden="true">
      <span className="block h-6" style={{ background: cover }} />
      <span className="block space-y-1 p-2" style={{ background: panel }}>
        <span className="block h-2.5 rounded-full" style={{ background: preset.theme_color }} />
        <span
          className="block h-2.5 rounded-full opacity-60"
          style={{ background: preset.theme_color }}
        />
      </span>
    </span>
  );
}

export function ThemeEditor({ ml, onChange }: Pick<Props, "ml" | "onChange">) {
  const bg = parseBackground(ml.background);
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

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium">Temas listos (con contraste AA)</p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MULTILINK_PRESETS.map((p) => {
            const active = presetMatches(ml, p);
            return (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  aria-pressed={active}
                  className={`relative w-full space-y-1 rounded-xl border p-1.5 text-left text-xs transition hover:border-foreground/40 ${active ? "border-foreground ring-1 ring-foreground" : ""}`}
                >
                  <PresetSwatch preset={p} />
                  <span className="block px-0.5 font-medium">{p.label}</span>
                  {active && (
                    <Check
                      className="absolute right-2 top-2 h-3.5 w-3.5 rounded-full bg-foreground p-0.5 text-background"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Color de marca">
          {(a) => (
            <Input
              {...a}
              type="color"
              value={ml.theme_color}
              onChange={(e) => onChange({ ...ml, theme_color: e.target.value })}
              className="h-9 w-16 p-1"
            />
          )}
        </Field>
        <Field label="Modo">
          {(a) => (
            <select
              {...a}
              className={selectClass}
              value={ml.theme_mode}
              onChange={(e) => onChange({ ...ml, theme_mode: e.target.value })}
            >
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          )}
        </Field>
      </div>

      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">Ajustes finos de estilo</summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Botones">
              {(a) => (
                <select
                  {...a}
                  className={selectClass}
                  value={ml.button_style}
                  onChange={(e) => onChange({ ...ml, button_style: e.target.value as ButtonStyle })}
                >
                  {(Object.keys(BUTTON_STYLE_LABEL) as ButtonStyle[]).map((k) => (
                    <option key={k} value={k}>
                      {BUTTON_STYLE_LABEL[k]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Forma">
              {(a) => (
                <select
                  {...a}
                  className={selectClass}
                  value={ml.button_shape}
                  onChange={(e) => onChange({ ...ml, button_shape: e.target.value as ButtonShape })}
                >
                  {(Object.keys(BUTTON_SHAPE_LABEL) as ButtonShape[]).map((k) => (
                    <option key={k} value={k}>
                      {BUTTON_SHAPE_LABEL[k]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Tipografía">
              {(a) => (
                <select
                  {...a}
                  className={selectClass}
                  value={ml.font_family}
                  onChange={(e) => onChange({ ...ml, font_family: e.target.value as FontKey })}
                >
                  {(Object.keys(FONTS) as FontKey[]).map((k) => (
                    <option key={k} value={k}>
                      {FONTS[k].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Fondo de la portada">
            {(a) => (
              <select
                {...a}
                className={selectClass}
                value={bg.type}
                onChange={(e) => {
                  const t = e.target.value as Background["type"];
                  if (t === "flat") setBg({ type: "flat" });
                  else if (t === "solid") setBg({ type: "solid", color: "#111827" });
                  else if (t === "gradient")
                    setBg({ type: "gradient", from: ml.theme_color, to: "#0e7490", angle: 135 });
                  else setBg({ type: "image", url: null, overlay: 0.45 });
                }}
              >
                <option value="flat">Color de marca</option>
                <option value="solid">Color sólido</option>
                <option value="gradient">Degradado</option>
                <option value="image">Imagen</option>
              </select>
            )}
          </Field>
          {bg.type === "solid" && (
            <Input
              type="color"
              aria-label="Color de fondo"
              value={bg.color}
              onChange={(e) => setBg({ ...bg, color: e.target.value })}
              className="h-9 w-16 p-1"
            />
          )}
          {bg.type === "gradient" && (
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
              <label className="min-w-[140px] flex-1 text-[11px] text-muted-foreground">
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
          )}
          {bg.type === "image" && <ImageBackground bg={bg} setBg={setBg} clientId={ml.client_id} />}
        </div>
      </details>
    </div>
  );
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
            className="h-14 w-20 rounded-lg object-cover"
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
      <label className="block text-[11px] text-muted-foreground">
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
