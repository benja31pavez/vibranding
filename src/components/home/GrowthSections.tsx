import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Dumbbell,
  HeartPulse,
  Home as HomeIcon,
} from "lucide-react";
import { trackLandingEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./shared";
import { translations } from "@/i18n/translations";
import { PhotoSlot } from "./mockups/PhotoSlot";
import { NICHE_PHOTOS } from "./mockups/photo-slots";
import { ProcessPanel } from "./mockups/ProcessPanel";

/** Copy del embudo de diagnóstico (la home pública es solo en español). */
export const DIAGNOSTICO_CTA = "Pide tu diagnóstico gratis";

const NICHE_ICONS = [HomeIcon, HeartPulse, Dumbbell];
const NICHE_TONES = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)"];

const FOR_YOU_IF = [
  "Tienes una pyme o emprendimiento en Chile y vendes servicios o productos",
  "Tus clientes te escriben por WhatsApp, o quieres que empiecen a hacerlo",
  "Quieres verte profesional en internet sin armar un equipo de marketing propio",
];

/** Proceso de Marca + Web: 2 a 3 semanas desde que recibimos tu información y el pago. */
const PROCESS = [
  {
    title: "Diagnóstico o conversación",
    desc: "Pides tu diagnóstico gratis o nos escribes por WhatsApp. Revisamos tu negocio y te recomendamos por dónde partir.",
  },
  {
    title: "Propuesta y pago",
    desc: "Te enviamos alcance y plazos por escrito. Pagas por transferencia o link de pago y recibes factura o boleta.",
  },
  {
    title: "Nos envías tu información",
    desc: "Lo que tengas: servicios, fotos, datos de contacto y, si existe, tu logo actual. Te guiamos con un formulario simple.",
  },
  {
    title: "Diseñamos contigo",
    desc: "Nuestro equipo trabaja tu kit de marca, tu landing y tu ficha de Google Business. Te mostramos avances, ajustamos y publicamos.",
  },
];

type LinkVariant = "primary" | "outline" | "onDark";

const LINK_VARIANTS: Record<LinkVariant, string> = {
  primary:
    "btn-shine bg-gradient-brand-strong text-white shadow-lg shadow-[color:var(--brand-2)]/25 hover:brightness-110",
  outline: "border border-foreground/15 bg-background text-foreground hover:bg-secondary",
  onDark: "border border-white/60 text-white hover:bg-white/10",
};

/** Botón hacia /diagnostico (opcionalmente con el plan de interés). */
export function DiagnosticoLink({
  children = DIAGNOSTICO_CTA,
  plan,
  cta,
  variant = "primary",
  size = "lg",
  className,
}: {
  children?: React.ReactNode;
  plan?: "marca-web" | "contenido" | "crecimiento";
  /** Id del botón para Estadísticas (por defecto "plan:<plan>" o "diagnostico"). */
  cta?: string;
  variant?: LinkVariant;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <Link
      to="/diagnostico"
      search={plan ? { plan } : {}}
      // contact_click = CTA de diagnóstico; los botones de WhatsApp registran whatsapp_click.
      onClick={() =>
        trackLandingEvent("contact_click", "es", cta ?? (plan ? `plan:${plan}` : "diagnostico"))
      }
      className={cn(
        "btn-fx inline-flex items-center justify-center gap-2 rounded-full font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        size === "lg" ? "h-12 px-7 text-base" : "h-10 px-4 text-sm",
        LINK_VARIANTS[variant],
        className,
      )}
    >
      <ClipboardCheck aria-hidden className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      {children}
    </Link>
  );
}

export function ForWhomSection() {
  const niches = translations.es.home.niches;
  return (
    <section
      id="para-quien"
      aria-labelledby="para-quien-title"
      className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24"
    >
      <SectionHeading
        id="para-quien-title"
        title="¿Para quién es"
        accent="Vibranding"
        end="?"
        subtitle="Pymes y emprendimientos de cualquier rubro. Algunos ejemplos:"
      />
      {/* Siempre una misma fila de 3, también en teléfono (tarjetas más altas y texto más chico). */}
      <ul data-reveal-stagger className="niche-grid grid grid-cols-3 gap-2 sm:gap-4">
        {niches.items.map((n, i) => {
          const Icon = NICHE_ICONS[i] ?? HomeIcon;
          return (
            <li
              key={n.title}
              className="card-fx group relative overflow-hidden rounded-2xl border bg-card sm:rounded-3xl"
            >
              <PhotoSlot
                images={NICHE_PHOTOS[i]}
                tone={NICHE_TONES[i]}
                sizes="33vw"
                imageClassName="object-[center_30%]"
                className="aspect-[3/5] sm:aspect-[4/5]"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                />
              </PhotoSlot>
              <div className="absolute inset-x-0 bottom-0 p-2.5 text-white sm:p-6">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15 backdrop-blur sm:h-11 sm:w-11 sm:rounded-2xl">
                  <Icon aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <h3 className="mt-2 text-[13px] font-semibold leading-tight [overflow-wrap:anywhere] sm:mt-4 sm:text-lg">
                  {n.title}
                </h3>
                <p className="mt-1 hidden text-sm text-white/85 sm:block">{n.desc}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/85 sm:hidden">{n.desc}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div data-reveal className="mx-auto mt-8 max-w-3xl rounded-3xl border border-dashed p-6">
        <h3 className="font-semibold">Es para ti si…</h3>
        <ul className="mt-3 space-y-2">
          {FOR_YOU_IF.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm md:text-base">
              <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-1)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function WorkWithUsSection() {
  return (
    <section
      id="como"
      aria-labelledby="como-title"
      className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 md:px-10 md:py-24"
    >
      <SectionHeading id="como-title" title="Cómo es trabajar" accent="con nosotros" />
      <ol
        data-reveal-stagger
        aria-label="Pasos para trabajar con nosotros"
        className="row-scroll lg:grid-cols-4 lg:gap-5"
      >
        {PROCESS.map((step, i) => (
          <li
            key={step.title}
            className="card-fx w-[76vw] max-w-[320px] rounded-3xl border bg-card p-6"
          >
            <span
              className="font-brand text-4xl leading-none text-gradient-brand-strong"
              aria-hidden
            >
              {i + 1}
            </span>
            <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
          </li>
        ))}
      </ol>
      <p className="row-scroll-hint" aria-hidden="true">
        Desliza para ver los 4 pasos →
      </p>
      <ProcessPanel />
      <p data-reveal className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">
        En los planes mensuales te enviamos el calendario de contenido durante la primera semana y
        las campañas parten apenas apruebas los anuncios.
      </p>
      <div data-reveal className="mt-8 flex justify-center">
        <DiagnosticoLink />
      </div>
    </section>
  );
}
