import { TextField } from "../Field";
import { LINK_KEYS, LINK_LABELS, type LinkKey } from "@/lib/onboarding/schema";
import type { StepProps } from "./types";

const PLACEHOLDER: Readonly<Record<LinkKey, string>> = {
  instagram: "@tunegocio",
  facebook: "https://facebook.com/tunegocio",
  tiktok: "@tunegocio",
  linkedin: "https://www.linkedin.com/company/tunegocio",
  youtube: "@tunegocio",
  x: "@tunegocio",
  web: "https://tunegocio.cl",
  otro: "https://…",
};

/** Paso 3: redes y sitio web (link https o @usuario). */
export function SocialStepFields({ state, update, errors }: StepProps) {
  const setLink = (key: LinkKey, value: string) => update({ links_redes: { ...state.links_redes, [key]: value } });
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Pega el link completo o tu @usuario. Completa solo las que uses.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {LINK_KEYS.map((key) => (
          <TextField
            key={key}
            id={`onb-link-${key}`}
            label={LINK_LABELS[key]}
            optional
            value={state.links_redes[key]}
            onChange={(v) => setLink(key, v)}
            error={errors[`links_redes.${key}`]}
            maxLength={300}
            inputMode="url"
            placeholder={PLACEHOLDER[key]}
          />
        ))}
      </div>
    </div>
  );
}
