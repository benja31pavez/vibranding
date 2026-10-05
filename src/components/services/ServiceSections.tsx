import { Check, X } from "lucide-react";
import type { ServiceContent } from "@/lib/services/content";
import { EYEBROW_CLASS } from "./ServiceHero";

export function SectionTitle({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-reveal className="mb-8 max-w-2xl">
      {eyebrow && <p className={EYEBROW_CLASS}>{eyebrow}</p>}
      <h2
        id={id}
        className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-balance md:text-4xl"
      >
        {children}
      </h2>
    </div>
  );
}

export function ProblemSolutionSection({ service }: { service: ServiceContent }) {
  const { problem, solution } = service;
  return (
    <section aria-labelledby="problema-titulo" className="bg-secondary/50 py-14 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:px-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <SectionTitle id="problema-titulo" eyebrow="El problema">
            {problem.title}
          </SectionTitle>
          <ul data-reveal-stagger className="space-y-4">
            {problem.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base">
                <X aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div data-reveal className="card-fx rounded-3xl border bg-card p-6 md:p-8">
          <p className={EYEBROW_CLASS}>La solución</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-balance md:text-3xl">
            {solution.title}
          </h2>
          <p className="mt-4 text-base text-muted-foreground text-pretty">{solution.body}</p>
          <ul className="mt-6 space-y-3">
            {solution.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base">
                <Check
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-1)]"
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function IncludesSection({ service }: { service: ServiceContent }) {
  return (
    <section aria-labelledby="incluye-titulo" className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        <SectionTitle id="incluye-titulo" eyebrow="Qué incluye">
          Esto es lo que recibes
        </SectionTitle>
        <ul data-reveal-stagger className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {service.includes.map((item) => (
            <li
              key={item}
              className="card-fx flex items-start gap-3 rounded-2xl border bg-card p-4 text-base sm:p-5"
            >
              <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-1)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProcessSection({ service }: { service: ServiceContent }) {
  return (
    <section aria-labelledby="proceso-titulo" className="py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        <SectionTitle id="proceso-titulo" eyebrow="Cómo trabajamos">
          Paso a paso
        </SectionTitle>
        <ol data-reveal-stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {service.steps.map((step, i) => (
            <li
              key={step.title}
              className="card-fx flex items-start gap-4 rounded-2xl border bg-card p-4 sm:block sm:p-5"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand-strong text-sm font-semibold text-white"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="pt-1 text-lg font-semibold leading-snug sm:mt-4 sm:pt-0">
                  <span className="sr-only">Paso {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground sm:mt-2">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
