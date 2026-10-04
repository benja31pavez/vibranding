import { TextField } from "../Field";
import { splitColors, type TextField as TextKey } from "../formState";
import type { StepProps } from "./types";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Paso 2: el negocio, su público, competencia y estilo visual. */
export function BusinessStepFields({ state, update, errors }: StepProps) {
  const bind = (key: TextKey) => ({
    id: `onb-${key}`,
    value: state[key],
    onChange: (value: string) => update({ [key]: value }),
    error: errors[key],
    optional: true,
  });
  const colors = splitColors(state.colores);
  const colorError = errors.colores ?? Object.entries(errors).find(([k]) => k.startsWith("colores."))?.[1];
  return (
    <div className="space-y-5">
      <TextField
        {...bind("descripcion")}
        label="¿Qué hace tu negocio?"
        multiline
        maxLength={4000}
        placeholder="Qué vendes u ofreces, desde cuándo, qué te hace distinto…"
      />
      <TextField
        {...bind("publico_objetivo")}
        label="¿A quién le vendes?"
        multiline
        maxLength={2000}
        placeholder="Ej. familias de Ñuñoa y Providencia, 30 a 50 años, que buscan…"
      />
      <TextField
        {...bind("competencia")}
        label="Competencia o marcas que admiras"
        multiline
        maxLength={2000}
        hint="Nombres o cuentas de Instagram. Nos ayuda a diferenciarte."
      />
      <TextField
        {...bind("estilo")}
        label="¿Cómo quieres que se vea y suene tu marca?"
        multiline
        maxLength={2000}
        placeholder="Ej. cercana y alegre, fotos luminosas, nada muy formal"
      />
      <TextField
        {...bind("colores")}
        error={colorError}
        label="Colores de tu marca"
        maxLength={600}
        placeholder="#1E3A8A, amarillo mostaza, blanco"
        hint="Separados por coma (máximo 12). Si no tienes definidos, déjalo en blanco."
      />
      {colors.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Colores ingresados">
          {colors.map((c, i) => (
            <li key={`${c}-${i}`} className="flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1 text-xs">
              {HEX.test(c) && <span aria-hidden className="h-3 w-3 rounded-full border border-border-subtle" style={{ backgroundColor: c }} />}
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
