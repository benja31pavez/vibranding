import { AlertTriangle, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, ImageUploadButton } from "@/components/site/fields";
import {
  HERO_ASPECT_LABEL,
  landingPalette,
  TEMPLATE_LABEL,
  type HeroAspect,
  type LandingTemplate,
} from "@/lib/landingTheme";
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

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

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
              className={`h-8 w-8 rounded-full border-2 ${lp.theme_color.toLowerCase() === c ? "border-foreground" : "border-transparent"}`}
              style={{ background: c }}
            />
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
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Diseño del encabezado">
          {(a) => (
            <select
              {...a}
              className={selectClass}
              value={lp.template}
              onChange={(e) => onChange({ ...lp, template: e.target.value as LandingTemplate })}
            >
              {Object.entries(TEMPLATE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Proporción de la foto">
          {(a) => (
            <select
              {...a}
              className={selectClass}
              value={lp.hero_aspect}
              onChange={(e) => onChange({ ...lp, hero_aspect: e.target.value as HeroAspect })}
            >
              {Object.entries(HERO_ASPECT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
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
