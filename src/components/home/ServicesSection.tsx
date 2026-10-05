import { Bot, Camera, Megaphone, MonitorSmartphone, Palette, Search, Sparkles } from "lucide-react";
import { useTilt } from "@/hooks/use-tilt";
import { translations } from "@/i18n/translations";
import { SectionHeading } from "./shared";
import { SERVICE_TILE_MOCKUPS } from "./mockups/ServiceTileMockups";

const SERVICE_ICONS = [Palette, Camera, Megaphone, Search];
const TONES = ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)", "var(--brand-1)"];

/**
 * "Lo que hacemos por ti": service tiles with a mini mockup each. With a mouse the tile tilts
 * toward the pointer, gets a gradient border and its mockup assembles; on touch screens the
 * mockups assemble once when the grid scrolls in. Static and complete without JS or motion.
 */
export function ServicesSection() {
  const s = translations.es.home.services; // The public home is Spanish-only (Chile).
  const tilt = useTilt();
  return (
    <section
      id="servicios"
      aria-labelledby="servicios-title"
      className="scroll-mt-20 bg-secondary/50 py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-10">
        <SectionHeading
          id="servicios-title"
          title={s.title}
          accent={s.titleAccent}
          subtitle={s.subtitle}
        />
        <ul data-reveal-stagger className="svc-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {s.items.map((item, i) => {
            const Icon = SERVICE_ICONS[i] ?? Sparkles;
            const Mockup = SERVICE_TILE_MOCKUPS[i];
            return (
              <li
                key={item.title}
                {...tilt}
                className="svc bx-glow relative flex flex-col rounded-3xl border bg-card"
              >
                <div
                  aria-hidden
                  className="relative grid h-40 place-items-center overflow-hidden rounded-t-3xl border-b px-5"
                  style={{
                    background: `radial-gradient(80% 90% at 20% 0%, color-mix(in oklab, ${TONES[i]} 18%, transparent), transparent 70%), var(--secondary)`,
                  }}
                >
                  {Mockup && (
                    <div className="svc-mock flex w-full justify-center">
                      <Mockup />
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="flex items-center gap-2.5 text-lg font-semibold">
                    <Icon aria-hidden className="h-5 w-5" style={{ color: TONES[i] }} />
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p
          data-reveal
          className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-dashed bg-background/70 p-4 text-sm text-foreground/80"
        >
          <span className="flex shrink-0 gap-1 pt-0.5" aria-hidden>
            <MonitorSmartphone className="h-4 w-4 text-[color:var(--brand-1)]" />
            <Bot className="h-4 w-4 text-[color:var(--brand-2)]" />
          </span>
          {s.extras}
        </p>
      </div>
    </section>
  );
}
