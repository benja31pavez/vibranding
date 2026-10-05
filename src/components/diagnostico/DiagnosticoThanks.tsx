import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { WhatsAppCta } from "@/components/home/shared";

const NEXT_STEPS = [
  {
    title: "Revisamos tu negocio",
    desc: "Miramos tu Instagram, tu web y cómo apareces en Google, si los tienes.",
  },
  {
    title: "Te escribimos",
    desc: "Te contactamos por WhatsApp o correo, en horario hábil, con lo que vimos y qué haríamos primero.",
  },
  {
    title: "Tú decides",
    desc: "Si te hace sentido, te recomendamos el plan que calza contigo. Sin compromiso.",
  },
];

export function DiagnosticoThanks({ negocio }: { negocio: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const message = `Hola Vibranding, acabo de pedir el diagnóstico gratis para mi negocio "${negocio}". `;

  return (
    <div className="text-center">
      <CheckCircle2 aria-hidden className="mx-auto h-12 w-12 text-[color:var(--brand-1)]" />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 text-3xl font-semibold tracking-tight text-balance focus:outline-none md:text-4xl"
      >
        ¡Listo! Recibimos tu solicitud
      </h1>
      <p role="status" className="mx-auto mt-3 max-w-xl text-muted-foreground">
        Gracias. Ya tenemos los datos de <strong className="text-foreground">{negocio}</strong> para preparar tu diagnóstico.
      </p>

      <h2 className="mt-10 text-left text-lg font-semibold">Próximos pasos</h2>
      <ol className="mt-4 space-y-3 text-left">
        {NEXT_STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl border bg-card p-4">
            <span className="font-brand text-2xl leading-none text-gradient-brand-strong" aria-hidden>
              {i + 1}
            </span>
            <span>
              <span className="block font-semibold">{s.title}</span>
              <span className="block text-sm text-muted-foreground">{s.desc}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-2xl bg-secondary p-5">
        <p className="text-sm font-medium">¿Quieres adelantar la conversación?</p>
        <WhatsAppCta message={message} className="mt-3 w-full sm:w-auto">
          Escríbenos por WhatsApp
        </WhatsAppCta>
      </div>
      <p className="mt-6 text-sm">
        <Link to="/" hash="planes" className="font-medium underline underline-offset-4">
          Ver planes y precios
        </Link>
      </p>
    </div>
  );
}
