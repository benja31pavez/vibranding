import { Check } from "lucide-react";
import {
  HERO_ASPECT_LABEL,
  landingPalette,
  TEMPLATE_LABEL,
  withAlpha,
  type HeroAspect,
  type LandingTemplate,
} from "@/lib/landingTheme";
import { cn } from "@/lib/utils";

const TEMPLATES = Object.keys(TEMPLATE_LABEL) as LandingTemplate[];
const ASPECTS = Object.keys(HERO_ASPECT_LABEL) as HeroAspect[];

const ASPECT_BOX: Record<HeroAspect, string> = {
  square: "h-5 w-5",
  portrait: "h-6 w-[1.15rem]",
  landscape: "h-[0.95rem] w-7",
};

/**
 * Miniatura de la portada con los colores reales: sirve para elegir diseño y
 * para mostrar cómo se ve cada plantilla por rubro.
 */
export function LayoutThumb({
  template,
  color,
  dark,
  className,
}: {
  template: LandingTemplate;
  color: string;
  dark: boolean;
  className?: string;
}) {
  const p = landingPalette(color, dark);
  const line = (w: string, strong?: boolean) => (
    <span
      className={cn("block h-1.5 rounded-full", w)}
      style={{ background: strong ? p.text : withAlpha(p.text, 0.25) }}
    />
  );
  const cta = <span className="block h-2 w-8 rounded-full" style={{ background: p.brand }} />;
  const photo = (cls: string) => (
    <span
      className={cn("block rounded-md", cls)}
      style={{
        background: `linear-gradient(135deg, ${withAlpha(p.brand, 0.55)}, ${withAlpha(p.brand, 0.2)})`,
      }}
    />
  );

  let hero: React.ReactNode;
  if (template === "fullbleed") {
    hero = (
      <span
        className="flex h-full flex-col items-center justify-center gap-1.5 rounded-md"
        style={{
          background: `linear-gradient(180deg, ${withAlpha("#000000", 0.35)}, ${withAlpha("#000000", 0.65)}), linear-gradient(135deg, ${p.brand}, ${withAlpha(p.brand, 0.4)})`,
        }}
      >
        <span className="block h-1.5 w-14 rounded-full bg-white" />
        <span className="block h-1.5 w-10 rounded-full bg-white/50" />
        {cta}
      </span>
    );
  } else if (template === "centered") {
    hero = (
      <span className="flex h-full flex-col items-center gap-1.5 pt-1">
        {line("w-14", true)}
        {line("w-10")}
        {cta}
        {photo("mt-0.5 h-full w-20")}
      </span>
    );
  } else {
    hero = (
      <span className="grid h-full grid-cols-2 items-center gap-2">
        <span className="flex flex-col gap-1.5">
          {line("w-full", true)}
          {line("w-3/4")}
          {cta}
        </span>
        {photo("h-full")}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("block overflow-hidden rounded-lg border p-2", className)}
      style={{ background: p.background, borderColor: withAlpha(p.text, 0.12) }}
    >
      <span className="mb-1.5 flex items-center justify-between">
        <span className="block h-1 w-6 rounded-full" style={{ background: p.text }} />
        <span className="block h-1.5 w-4 rounded-full" style={{ background: p.brand }} />
      </span>
      <span className="block h-14">{hero}</span>
    </span>
  );
}

/** Selector visual del diseño de portada (radio con miniaturas). */
export function HeroLayoutPicker({
  value,
  color,
  dark,
  onChange,
}: {
  value: LandingTemplate;
  color: string;
  dark: boolean;
  onChange: (t: LandingTemplate) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Diseño de la portada" className="grid grid-cols-3 gap-2">
      {TEMPLATES.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t)}
            className={cn(
              "group relative rounded-app-lg border bg-surface p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary ring-1 ring-primary"
                : "border-border-subtle hover:border-border-strong",
            )}
          >
            <LayoutThumb template={t} color={color} dark={dark} />
            <span className="mt-1.5 flex items-center justify-between gap-1 px-0.5 text-xs font-medium">
              {TEMPLATE_LABEL[t]}
              {active && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Proporción de la foto principal en botones segmentados con su forma. */
export function AspectPicker({
  value,
  onChange,
}: {
  value: HeroAspect;
  onChange: (a: HeroAspect) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Proporción de la foto"
      className="inline-flex rounded-app-md border border-border-subtle bg-surface-2 p-0.5"
    >
      {ASPECTS.map((a) => {
        const active = value === a;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(a)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-app-sm px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-surface text-foreground shadow-app-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn("rounded-[3px] border-2", ASPECT_BOX[a])}
              style={{ borderColor: "currentColor" }}
              aria-hidden="true"
            />
            {HERO_ASPECT_LABEL[a]}
          </button>
        );
      })}
    </div>
  );
}
