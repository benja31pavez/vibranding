import { AlertTriangle, Check, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, ImageUploadButton } from "@/components/site/fields";
import { bestOn, landingPalette } from "@/lib/landingTheme";
import { AspectPicker, HeroLayoutPicker } from "./LayoutThumb";
import { isExampleText, type LandingDraft, type LandingErrors } from "@/lib/site/landingDraft";

type Props = {
  lp: LandingDraft;
  onChange: (next: LandingDraft) => void;
  errors: LandingErrors;
  clientId: string;
};

/** Paleta sugerida: colores con buen contraste sobre blanco para pymes chilenas. */
const SWATCHES = [
  "#15803d",
  "#0e7490",
  "#1d4ed8",
  "#7c3aed",
  "#be185d",
  "#b45309",
  "#b91c1c",
  "#0f172a",
];

export function StyleEditor({
  lp,
  onChange,
  brandColors = [],
}: Omit<Props, "errors" | "clientId"> & {
  /** Colores del onboarding del cliente: van primero. */
  brandColors?: string[];
}) {
  const palette = landingPalette(lp.theme_color, lp.dark_mode);
  const swatches = [...new Set([...brandColors, ...SWATCHES])];
  return (
    <div className="space-y-4">
      <div>
        <span className="text-xs font-medium">Color de marca</span>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...lp, theme_color: c })}
              aria-label={`Usar color ${c}${brandColors.includes(c) ? " (del cliente)" : ""}`}
              title={brandColors.includes(c) ? `${c} · color del cliente` : c}
              aria-pressed={lp.theme_color.toLowerCase() === c}
              className={`grid h-8 w-8 place-items-center rounded-full border-2 transition motion-safe:hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${lp.theme_color.toLowerCase() === c ? "border-foreground" : "border-transparent"}`}
              style={{ background: c, color: bestOn(c) }}
            >
              {lp.theme_color.toLowerCase() === c && (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ))}
          <label className="inline-flex items-center gap-2 text-xs">
            <Input
              type="color"
              value={lp.theme_color}
              onChange={(e) => onChange({ ...lp, theme_color: e.target.value })}
              className="h-8 w-12 p-1"
              aria-label="Color personalizado"
            />
            Otro
          </label>
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-medium">Diseño de la portada</span>
        <HeroLayoutPicker
          value={lp.template}
          color={lp.theme_color}
          dark={lp.dark_mode}
          onChange={(template) => onChange({ ...lp, template })}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium">Proporción de la foto</span>
          <AspectPicker
            value={lp.hero_aspect}
            onChange={(hero_aspect) => onChange({ ...lp, hero_aspect })}
          />
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <Switch
            checked={lp.dark_mode}
            onCheckedChange={(v) => onChange({ ...lp, dark_mode: v })}
          />
          <Moon className="h-4 w-4" aria-hidden="true" /> Modo oscuro
        </label>
      </div>
      {palette.lowContrast && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          Este color tiene poco contraste sobre el fondo ({palette.contrast.toFixed(1)}:1). Los
          textos usan automáticamente una versión más legible para cumplir AA.
        </p>
      )}
    </div>
  );
}

export function HeroEditor({ lp, onChange, errors, clientId }: Props) {
  return (
    <div className="space-y-3">
      <Field
        label="Título principal"
        error={errors.hero_title}
        hint="Nombre del negocio o la promesa principal"
      >
        {(a) => (
          <Input
            {...a}
            maxLength={120}
            value={lp.hero_title}
            onChange={(e) => onChange({ ...lp, hero_title: e.target.value })}
          />
        )}
      </Field>
      <Field label="Subtítulo" example={isExampleText(lp.hero_subtitle)}>
        {(a) => (
          <Textarea
            {...a}
            rows={3}
            maxLength={300}
            value={lp.hero_subtitle ?? ""}
            onChange={(e) => onChange({ ...lp, hero_subtitle: e.target.value })}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        {lp.hero_image_url && (
          <img
            src={lp.hero_image_url}
            alt="Imagen principal"
            width={80}
            height={80}
            className="h-20 w-20 rounded-lg object-cover"
          />
        )}
        <ImageUploadButton
          clientId={clientId}
          label={lp.hero_image_url ? "Cambiar foto principal" : "Subir foto principal"}
          onUploaded={([url]) => onChange({ ...lp, hero_image_url: url })}
        />
        {lp.hero_image_url && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({ ...lp, hero_image_url: null })}
          >
            Quitar
          </Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Texto del botón principal">
          {(a) => (
            <Input
              {...a}
              maxLength={40}
              placeholder="Cotizar gratis"
              value={lp.cta_text ?? ""}
              onChange={(e) => onChange({ ...lp, cta_text: e.target.value })}
            />
          )}
        </Field>
        <Field
          label="Destino del botón (opcional)"
          error={errors.cta_url}
          hint="Vacío: va al formulario o a WhatsApp. También acepta https://…"
        >
          {(a) => (
            <Input
              {...a}
              maxLength={500}
              placeholder="https://…"
              value={lp.cta_url ?? ""}
              onChange={(e) => onChange({ ...lp, cta_url: e.target.value })}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
