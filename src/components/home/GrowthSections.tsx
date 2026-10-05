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

/** Proceso de Marca + Web: 72 horas hábiles desde que recibimos tu información y el pago. */
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
    title: "Entrega en 72 horas hábiles",
    desc: "Para Marca + Web: kit de marca, landing con botón de WhatsApp y formulario, y tu ficha de Google Business optimizada.",
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
  variant = "primary",
  size = "lg",
  className,
}: {
  children?: React.ReactNode;
  plan?: "marca-web" | "contenido" | "crecimiento";
  variant?: LinkVariant;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <Link
      to="/diagnostico"
      search={plan ? { plan } : {}}
      // contact_click = CTA de diagnóstico; los botones de WhatsApp registran whatsapp_click.
      onClick={() => trackLandingEvent("contact_click", "es")}
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
        title="¿Para quién"
        accent="es Vibranding"
        end="?"
        subtitle="Trabajamos con pymes de servicios."
      />
      <ul data-reveal-stagger className="grid gap-4 sm:grid-cols-3">
        {niches.items.map((n, i) => {
          const Icon = NICHE_ICONS[i] ?? HomeIcon;
          return (
            <li
              key={n.title}
              className="card-fx group relative overflow-hidden rounded-3xl border bg-card"
            >
              <PhotoSlot
                images={NICHE_PHOTOS[i]}
                tone={NICHE_TONES[i]}
                sizes="(min-width: 640px) 33vw, 100vw"
                imageClassName="object-[center_30%]"
                className="aspect-[4/3] sm:aspect-[4/5]"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                />
              </PhotoSlot>
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{n.title}</h3>
                <p className="mt-1 text-sm text-white/85">{n.desc}</p>
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
      <SectionHeading
        id="como-title"
        title="Cómo es trabajar"
        accent="con nosotros"
        subtitle="Marca + Web se entrega en 72 horas hábiles desde que recibimos tu información y el pago."
      />
      <ol data-reveal-stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PROCESS.map((step, i) => (
          <li key={step.title} className="card-fx rounded-3xl border bg-card p-6">
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

/** Franja de diagnóstico gratis, justo después del hero. */
export function DiagnosticoBanner() {
  return (
    <section aria-labelledby="diagnostico-banner-title" className="px-4 md:px-10">
      <div
        className="hero-in mx-auto flex max-w-5xl flex-col items-start gap-5 rounded-3xl border-2 border-[color:var(--brand-2)]/40 bg-card p-6 md:flex-row md:items-center md:justify-between md:p-8"
        style={{ "--d": "420ms" } as React.CSSProperties}
      >
        <div>
          <h2 id="diagnostico-banner-title" className="text-xl font-semibold md:text-2xl">
            Diagnóstico gratis de tu marca
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Cuéntanos de tu negocio en 1 minuto. Revisamos tu Instagram, tu web y tu ficha de
            Google, y te decimos qué haríamos primero. Sin compromiso.
          </p>
        </div>
        <DiagnosticoLink className="w-full shrink-0 md:w-auto">
          Quiero mi diagnóstico <ArrowRight aria-hidden className="btn-arrow h-4 w-4" />
        </DiagnosticoLink>
      </div>
    </section>
  );
}
