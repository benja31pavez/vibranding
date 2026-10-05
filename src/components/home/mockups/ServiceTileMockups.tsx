import { Heart, Search } from "lucide-react";
import { Bar, BrandAvatar, WhatsAppGlyph } from "./parts";
import { SWATCHES, vars } from "./tokens";

/**
 * Mini mockups on top of each "Lo que hacemos por ti" tile (decorative). Pieces marked
 * `bx-in` / `bx-pop` assemble on hover (or once on reveal on touch screens); the static frame
 * is the finished mockup.
 */

function at(delay: number): React.CSSProperties {
  return vars({ "--d": `${delay}s` });
}

const PANEL = "w-full max-w-[220px] rounded-xl border bg-card p-3 text-foreground shadow-lg";

function BrandingTile() {
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-2">
        <span className="bx-pop">
          <BrandAvatar size="h-9 w-9 text-lg" />
        </span>
        <span className="bx-in font-brand text-lg text-gradient-brand-strong" style={at(0.15)}>
          Tu marca
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {SWATCHES.slice(0, 4).map((bg, i) => (
          <span
            key={bg}
            className="bx-pop h-6 w-6 rounded-full"
            style={{ ...at(0.25 + i * 0.07), background: bg }}
          />
        ))}
        <span className="bx-in ml-auto font-brand text-xl leading-none" style={at(0.55)}>
          Aa
        </span>
      </div>
    </div>
  );
}

const WEEK = ["L", "M", "M", "J", "V", "S", "D"];
const PLANNED_DAYS = new Set([0, 2, 4]);

function ContentTile() {
  return (
    <div className={PANEL}>
      <div className="grid grid-cols-3 gap-1">
        {[0, 4, 2].map((swatch, i) => (
          <span
            key={swatch}
            className="bx-in relative aspect-square rounded-md"
            style={{ ...at(i * 0.1), background: SWATCHES[swatch] }}
          >
            {i === 1 && (
              <Heart
                className="bx-pop absolute left-1/2 top-1/2 -ml-2.5 -mt-2.5 h-5 w-5 fill-white text-white"
                style={at(0.5)}
              />
            )}
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[0.55rem] text-muted-foreground">
        {WEEK.map((day, i) => (
          <span key={`${day}-${i}`} className="flex flex-col items-center gap-0.5">
            {day}
            <span
              className={
                PLANNED_DAYS.has(i)
                  ? "bx-pop h-1.5 w-1.5 rounded-full bg-[color:var(--brand-2)]"
                  : "h-1.5 w-1.5 rounded-full bg-foreground/10"
              }
              style={at(0.35 + i * 0.05)}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function MetaTile() {
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-2">
        <BrandAvatar />
        <div className="leading-tight">
          <p className="text-[0.65rem] font-semibold">Tu marca</p>
          <p className="text-[0.55rem] text-muted-foreground">Patrocinado</p>
        </div>
      </div>
      <div className="bx-in mt-2 h-12 rounded-md" style={{ ...at(0.1), background: SWATCHES[1] }} />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Bar w="45%" />
        <span
          className="bx-pop inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[0.55rem] font-semibold"
          style={at(0.4)}
        >
          <WhatsAppGlyph className="h-3 w-3 text-[#25D366]" />
          Enviar mensaje
        </span>
      </div>
    </div>
  );
}

function GoogleTile() {
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[0.6rem]">
        <Search className="h-3 w-3 text-muted-foreground" />
        tu servicio cerca de ti
      </div>
      <div className="bx-in mt-2.5 space-y-1" style={at(0.2)}>
        <p className="text-[0.55rem]">
          <span className="font-bold">Patrocinado</span>
          <span className="text-muted-foreground"> · tumarca.cl</span>
        </p>
        <p className="text-xs font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
          Tu marca | Agenda tu hora
        </p>
        <Bar w="90%" />
      </div>
      <div className="bx-in mt-2 space-y-1" style={at(0.4)}>
        <Bar w="40%" />
        <Bar w="75%" />
      </div>
    </div>
  );
}

export const SERVICE_TILE_MOCKUPS = [BrandingTile, ContentTile, MetaTile, GoogleTile] as const;
