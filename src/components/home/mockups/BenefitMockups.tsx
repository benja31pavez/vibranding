import { CheckCheck, Globe, MapPin, Navigation, Phone, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BrandAvatar, WhatsAppGlyph } from "./parts";
import { SWATCHES, vars } from "./tokens";

/**
 * Mini mockups for "Tres pilares para que tu negocio venda" (decorative).
 * Pieces marked `bx-in` / `bx-pop` assemble one after another (delay `--d`) when their card
 * reveals; the static frame is the finished mockup. `bx-typing` dots loop as idle motion.
 */

const CARD = "w-full max-w-[340px] rounded-2xl border bg-card text-foreground shadow-xl";

function at(delay: number): React.CSSProperties {
  return vars({ "--d": `${delay}s` });
}

/** "Te encuentran": a search that ends in the business profile on Google. */
function FoundMock() {
  const actions = [
    { label: "Llamar", Icon: Phone },
    { label: "Cómo llegar", Icon: Navigation },
    { label: "Sitio web", Icon: Globe },
  ];
  return (
    <div className={cn(CARD, "p-4")}>
      <div className="bx-in flex items-center gap-2 rounded-full border px-3 py-2 text-xs">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        tu servicio cerca de ti
      </div>
      <div
        className="bx-in relative mt-3 h-20 overflow-hidden rounded-xl"
        style={{ ...at(0.15), background: SWATCHES[3] }}
      >
        <span className="absolute inset-x-0 top-1/2 h-2 -rotate-6 bg-white/30" />
        <span className="absolute inset-y-0 left-1/3 w-2 rotate-12 bg-white/25" />
        <MapPin
          className="bx-pop absolute left-1/2 top-1/2 -ml-3 -mt-5 h-6 w-6 fill-white text-[color:var(--brand-2)]"
          style={at(0.45)}
        />
      </div>
      <div className="bx-in mt-3 space-y-1" style={at(0.3)}>
        <p className="font-semibold">Tu marca</p>
        <p className="text-[0.7rem] text-muted-foreground">
          Negocio local · <span className="font-medium text-[#188038]">Abierto</span>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {actions.map(({ label, Icon }, i) => (
          <span
            key={label}
            className="bx-in flex flex-col items-center gap-1 rounded-xl border py-2 text-[0.6rem] font-medium text-[#1a73e8]"
            style={at(0.55 + i * 0.1)}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "Te eligen": the brand kit forms and turns into consistent posts. */
function ChosenMock() {
  return (
    <div className={cn(CARD, "p-4")}>
      <div className="flex items-center gap-3">
        <span className="bx-pop" style={at(0)}>
          <BrandAvatar size="h-14 w-14 text-2xl" />
        </span>
        <div className="bx-in space-y-1.5" style={at(0.2)}>
          <p className="font-brand text-2xl leading-none text-gradient-brand-strong">Tu marca</p>
          <Bar w="7rem" />
        </div>
      </div>
      <div className="mt-4 flex items-end gap-2">
        {SWATCHES.slice(0, 4).map((bg, i) => (
          <span
            key={bg}
            className="bx-pop h-9 w-9 rounded-full ring-2 ring-card"
            style={{ ...at(0.35 + i * 0.08), background: bg }}
          />
        ))}
        <span className="bx-in ml-auto font-brand text-3xl leading-none" style={at(0.7)}>
          Aa
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1">
        {[0, 2, 4].map((swatch, i) => (
          <span
            key={swatch}
            className="bx-in relative aspect-square overflow-hidden rounded-md"
            style={{ ...at(0.8 + i * 0.1), background: SWATCHES[swatch] }}
          >
            <span className="absolute bottom-1.5 left-1.5 font-brand text-[0.6rem] text-white">
              Tu marca
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** "Te compran": a customer writes on WhatsApp and gets an answer. */
function BuyMock() {
  return (
    <div className={cn(CARD, "overflow-hidden")}>
      <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2 text-white">
        <BrandAvatar />
        <div className="leading-tight">
          <p className="text-xs font-semibold">Tu marca</p>
          <p className="text-[0.6rem] text-white/75">en línea</p>
        </div>
        <WhatsAppGlyph className="ml-auto h-4 w-4" />
      </div>
      <div className="space-y-2 bg-[#25D366]/[0.07] p-3 text-xs leading-snug">
        <p
          className="bx-in mr-8 rounded-xl rounded-tl-sm bg-card px-3 py-2 shadow-sm"
          style={at(0.1)}
        >
          Hola, vi su página. ¿Me pueden cotizar?
        </p>
        <p
          className="bx-in ml-8 rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-neutral-900 shadow-sm"
          style={at(0.7)}
        >
          ¡Hola! Claro, te enviamos los detalles por aquí.
          <CheckCheck className="ml-1 inline h-3.5 w-3.5 text-[#53BDEB]" />
        </p>
        <p
          className="bx-in mr-8 rounded-xl rounded-tl-sm bg-card px-3 py-2 shadow-sm"
          style={at(1.3)}
        >
          ¡Perfecto, gracias!
        </p>
        <span
          className="bx-in ml-auto flex w-fit gap-1 rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2.5 shadow-sm"
          style={at(1.8)}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="bx-typing h-1.5 w-1.5 rounded-full bg-neutral-500"
              style={vars({ "--i": dot })}
            />
          ))}
        </span>
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <span className="flex-1 rounded-full bg-secondary px-3 py-1.5 text-[0.65rem] text-muted-foreground">
          Mensaje
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#25D366] text-white">
          <WhatsAppGlyph className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}

export const BENEFIT_MOCKUPS = [FoundMock, ChosenMock, BuyMock] as const;
