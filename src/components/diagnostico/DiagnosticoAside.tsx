import { Check, Clock, Gift, ShieldCheck } from "lucide-react";
import { WhatsAppGlyph } from "@/components/home/mockups/parts";
import { whatsappUrl } from "@/lib/site";
import { DiagnosticoPreview } from "./DiagnosticoPreview";

/** Left column of /diagnostico under the intro. */

const INCLUDES = [
  "Cómo se ve tu marca hoy frente a tu competencia",
  "Qué mejorar en tu Instagram, tu web y tu ficha de Google",
  "Por dónde partir y qué plan te conviene (si alguno te conviene)",
];

const STEPS = [
  { title: "Completas el formulario", note: "Toma 1 minuto." },
  {
    title: "Revisamos tu Instagram, web y ficha de Google",
    note: "Vemos cómo te ve hoy un cliente.",
  },
  {
    title: "Te enviamos el diagnóstico por WhatsApp o correo",
    note: "Con por dónde partir, en horario hábil.",
  },
];

const TRUST = [
  { label: "Sin costo ni compromiso", Icon: Gift },
  { label: "Tus datos protegidos (Ley 21.719)", Icon: ShieldCheck },
  { label: "Respuesta en horario hábil", Icon: Clock },
];

/** "Qué incluye": sits under the intro, so on mobile it stays above the form. */
export function DiagnosticoIncludes() {
  return (
    <section aria-labelledby="dx-incluye">
      <h2 id="dx-incluye" className="text-base font-semibold">
        Qué incluye
      </h2>
      <ul className="mt-3 space-y-3">
        {INCLUDES.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm md:text-base">
            <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-1)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** How it works, the example preview and trust signals: the sticky part on desktop. */
export function DiagnosticoAside() {
  return (
    <div className="space-y-8">
      <section aria-labelledby="dx-como">
        <h2 id="dx-como" className="text-base font-semibold">
          Cómo funciona
        </h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-brand-strong text-xs font-semibold text-white"
              >
                {index + 1}
              </span>
              <span className="text-sm md:text-base">
                <span className="font-medium">{step.title}</span>
                <span className="block text-sm text-muted-foreground">{step.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <DiagnosticoPreview />

      <div>
        <ul className="flex flex-wrap gap-2" aria-label="Garantías del diagnóstico">
          {TRUST.map(({ label, Icon }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"
            >
              <Icon aria-hidden className="h-3.5 w-3.5 text-[color:var(--brand-1)]" />
              {label}
            </li>
          ))}
        </ul>
        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <WhatsAppGlyph className="h-4 w-4 text-[#25D366]" />
          ¿Prefieres hablar? Escríbenos por WhatsApp
        </a>
      </div>
    </div>
  );
}
