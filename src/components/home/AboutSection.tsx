import { Check } from "lucide-react";
import { SectionHeading } from "./shared";
import { translations } from "@/i18n/translations";

export function AboutSection() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const a = t.home.about;
  return (
    <section
      id="nosotros"
      aria-labelledby="nosotros-title"
      className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 md:px-10 md:py-24"
    >
      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
        <figure className="mx-auto w-full max-w-[13rem] md:max-w-xs">
          {/* TODO: reemplazar por la foto real de Benjamín (p. ej. public/benjamin.jpg, 800x1000, con alt descriptivo). */}
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-gradient-brand-strong shadow-xl">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]"
            />
            <div className="absolute inset-0 grid place-items-center">
              <span className="font-brand text-7xl text-white/95" aria-hidden>
                {a.initials}
              </span>
            </div>
          </div>
          <figcaption className="mt-4 text-center">
            <span className="block text-lg font-semibold">{a.name}</span>
            <span className="block text-sm text-muted-foreground">{a.role}</span>
          </figcaption>
        </figure>

        <div>
          <SectionHeading id="nosotros-title" title={a.title} accent={a.titleAccent} align="left" />
          <div className="-mt-4 space-y-4 text-base leading-relaxed text-foreground/85 md:text-lg">
            {a.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {a.highlights.map((h) => (
              <li
                key={h}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm"
              >
                <Check aria-hidden className="h-3.5 w-3.5 text-[color:var(--brand-1)]" /> {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
