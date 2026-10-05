import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BrandAvatar } from "./parts";
import { SWATCHES, vars } from "./tokens";

const SLIDES = ["Tu marca", "Nuevo servicio", "Agenda por WhatsApp"];
const TILES = [3, 4, 5, 0, 2, 1];

/** Phone with an Instagram-style profile for the fictional brand "Tu marca". */
export function PhoneFeed({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[2.4rem] bg-neutral-900 p-2 shadow-2xl shadow-[color:var(--brand-2)]/25 ring-1 ring-black/10",
        className,
      )}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-card text-foreground">
        <span className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-neutral-900" />
        <div className="flex items-center justify-between px-4 pb-2 pt-8">
          <span className="text-sm font-semibold">tumarca</span>
          <span className="flex gap-1.5">
            <span className="h-3.5 w-3.5 rounded-md border-2 border-foreground/70" />
            <span className="h-3.5 w-3.5 rounded-full border-2 border-foreground/70" />
          </span>
        </div>
        <div className="flex items-center gap-3 px-4">
          <BrandAvatar size="h-14 w-14 text-2xl" />
          <div className="flex-1 space-y-1.5">
            <p className="text-xs font-semibold">Tu marca</p>
            <Bar w="90%" />
            <Bar w="65%" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 px-4 text-[0.65rem] font-semibold">
          <span className="rounded-md bg-[color:var(--brand-1)] py-1 text-center text-white">
            Seguir
          </span>
          <span className="rounded-md bg-secondary py-1 text-center">Mensaje</span>
        </div>
        <div className="flex gap-3 px-4 py-3">
          {SWATCHES.slice(0, 4).map((bg) => (
            <span
              key={bg}
              className="h-8 w-8 rounded-full border-2 border-card ring-1 ring-foreground/15"
              style={{ background: bg }}
            />
          ))}
        </div>
        <div className="relative aspect-[4/3] overflow-hidden">
          <div className="mk-carousel flex h-full w-[300%]">
            {SLIDES.map((label, i) => (
              <div
                key={label}
                className="relative flex h-full w-1/3 items-end p-3"
                style={{ background: SWATCHES[i] }}
              >
                <span className="absolute right-4 top-4 h-14 w-14 rounded-full bg-white/25" />
                <span className="absolute right-12 top-12 h-8 w-8 rounded-full bg-white/20" />
                <span className="font-brand text-lg leading-tight text-white drop-shadow">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <Heart className="mk-heart absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 fill-white text-white drop-shadow-lg" />
          <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {SLIDES.map((label) => (
              <span key={label} className="h-1.5 w-1.5 rounded-full bg-white/50" />
            ))}
            <span className="mk-dot absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-0.5 pt-0.5">
          {TILES.map((swatch, i) => (
            <span
              key={swatch}
              className="mk-loop min-h-16"
              style={{
                ...vars({ "--i": i, "--gap": "0.35s", "--dur": "12s" }),
                background: SWATCHES[swatch],
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
