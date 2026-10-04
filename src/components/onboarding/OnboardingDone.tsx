import { CheckCircle2 } from "lucide-react";

const NEXT_STEPS = [
  {
    title: "Revisamos tu información",
    text: "Nuestro equipo lee todo lo que nos enviaste en los próximos días hábiles.",
  },
  {
    title: "Coordinamos los accesos",
    text: "Te escribimos para que nos invites como colaboradores en tus redes, paso a paso y sin compartir contraseñas.",
  },
  {
    title: "Partimos con tu marca",
    text: "Agendamos una reunión de inicio y te mostramos la primera propuesta de contenido.",
  },
];

/** Confirmación tras enviar el onboarding. */
export function OnboardingDone({ clientName }: { clientName: string }) {
  return (
    <section className="space-y-6 rounded-app-lg border border-border-subtle bg-surface p-6 text-center shadow-app-xs sm:p-8" aria-live="polite">
      <CheckCircle2 aria-hidden className="mx-auto h-12 w-12 text-success" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">¡Listo! Ya tenemos todo para empezar</h1>
        <p className="text-muted-foreground">Gracias por confiar en nosotros, {clientName}.</p>
      </div>
      <div className="text-left">
        <h2 className="mb-3 text-sm font-semibold text-foreground">¿Qué pasa ahora?</h2>
        <ol className="space-y-3">
          {NEXT_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
