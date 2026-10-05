import { CreditCard, ExternalLink, LifeBuoy, MessageCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ADS_CHOICES,
  ADS_GUIDES,
  platformsForChoice,
  type AdsGuide,
} from "@/lib/ads-billing/guides";
import type { AdsPlatform } from "@/lib/ads-billing/combined";
import { whatsappUrl } from "@/lib/site";
import type { StepProps } from "./types";

/**
 * Paso "Publicidad: agrega tu tarjeta". El cliente paga la pauta con su propia
 * tarjeta, directo a Google/Meta: aquí elige dónde va a publicitar y sigue una
 * guía corta por plataforma. Nunca se pide ni se guarda un dato de tarjeta.
 */
export function AdsStepFields({ state, update }: StepProps) {
  const platforms = platformsForChoice(state.ads_choice);
  const setCard = (p: AdsPlatform, checked: boolean) =>
    update({ ads_card: { ...state.ads_card, [p]: checked } });

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="flex gap-3 rounded-app-lg border border-info/30 bg-info-subtle p-4 text-sm"
      >
        <CreditCard aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-info-strong" />
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground">La publicidad la pagas tú, directo.</p>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>La tarjeta queda a tu nombre, en tu propia cuenta publicitaria.</li>
            <li>Google o Meta te cobran directamente lo que se gaste en anuncios.</li>
            <li>Vibranding nunca cobra la pauta: solo nuestro servicio.</li>
            <li>Definimos juntos un límite mensual que acuerdas con Benja.</li>
          </ul>
          <p className="text-muted-foreground">
            Nunca escribas los datos de tu tarjeta en este formulario.
          </p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">¿Dónde vas a publicitar?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ADS_CHOICES.map((c) => {
            const checked = state.ads_choice === c.value;
            return (
              <label
                key={c.value}
                className={`flex cursor-pointer flex-col rounded-app-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-subtle bg-surface hover:bg-muted"
                }`}
              >
                <input
                  type="radio"
                  name="onb-ads-choice"
                  value={c.value}
                  checked={checked}
                  onChange={() => update({ ads_choice: c.value })}
                  className="sr-only"
                />
                <span className="font-medium">{c.label}</span>
                <span
                  className={`text-xs ${checked ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                >
                  {c.hint}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {platforms?.length === 0 && (
        <p className="rounded-app-lg border border-border-subtle bg-muted/40 p-4 text-sm text-muted-foreground">
          Sin problema. Cuando decidas partir con publicidad te enviamos esta misma guía.
        </p>
      )}

      {platforms?.map((p) => (
        <GuideCard
          key={p}
          guide={ADS_GUIDES[p]}
          checked={state.ads_card[p]}
          onCheckedChange={(v) => setCard(p, v)}
        />
      ))}

      {platforms && platforms.length > 0 && <AdsHelpNote />}
    </div>
  );
}

/** Salida para quien se complica: puede seguir y lo hacemos juntos. */
function AdsHelpNote() {
  return (
    <div className="flex flex-col gap-3 rounded-app-lg border border-border-subtle bg-surface-2 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <LifeBuoy aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">¿Te complicaste?</span> Sigue con el
          formulario sin marcarlo: te acompañamos paso a paso por WhatsApp o videollamada.
        </p>
      </div>
      <a
        href={whatsappUrl(ADS_HELP_MESSAGE)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-app-md border border-border-subtle bg-surface px-3 font-medium text-primary hover:bg-muted"
      >
        <MessageCircle aria-hidden className="h-4 w-4" /> Pedir ayuda
        <span className="sr-only">por WhatsApp (se abre en otra pestaña)</span>
      </a>
    </div>
  );
}

const ADS_HELP_MESSAGE =
  "Hola, estoy completando el formulario de bienvenida y necesito ayuda para agregar mi tarjeta en la cuenta publicitaria.";

function GuideCard({
  guide,
  checked,
  onCheckedChange,
}: {
  guide: AdsGuide;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const checkId = `onb-ads-card-${guide.platform}`;
  return (
    <section
      aria-labelledby={`${checkId}-title`}
      className="space-y-4 rounded-app-lg border border-border-subtle bg-surface p-4 sm:p-5"
    >
      <h3 id={`${checkId}-title`} className="text-base font-semibold text-foreground">
        Agrega tu tarjeta en {guide.title}
      </h3>
      <ol className="space-y-2.5">
        {guide.steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
            >
              {i + 1}
            </span>
            <span className="pt-0.5 text-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{guide.limitTip}</p>
      <a
        href={guide.link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-app-md border border-border-subtle px-3 text-sm font-medium text-primary hover:bg-muted"
      >
        {guide.link.label} <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        <span className="sr-only">(se abre en otra pestaña)</span>
      </a>
      <div
        className={`flex items-center gap-3 rounded-app-md border p-3 ${
          checked ? "border-success/40 bg-success-subtle" : "border-border-subtle"
        }`}
      >
        <Checkbox
          id={checkId}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="h-5 w-5"
        />
        <Label htmlFor={checkId} className="cursor-pointer text-sm font-medium">
          Ya agregué mi tarjeta en {guide.title}
        </Label>
      </div>
    </section>
  );
}
