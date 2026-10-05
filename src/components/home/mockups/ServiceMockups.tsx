import { Search } from "lucide-react";
import type { ServiceSlug } from "@/lib/services/content";
import { cn } from "@/lib/utils";
import { AdCard } from "./AdCard";
import { Bar, BrandAvatar, WhatsAppGlyph } from "./parts";
import { SWATCHES, vars } from "./tokens";
import { PhoneFeed } from "./PhoneFeed";

const CARD = "rounded-2xl border bg-card text-foreground shadow-xl";

/** Google search with a sponsored result for "Tu marca". */
function SearchMock() {
  return (
    <div className={cn(CARD, "w-full max-w-[320px] p-4")}>
      <div className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <span>tu servicio cerca de ti</span>
        <span className="mk-caret -ml-1.5 h-3.5 w-px bg-foreground" />
      </div>
      <div className="mk-loop mt-4 space-y-1" style={vars({ "--i": 1 })}>
        <p className="text-[0.65rem]">
          <span className="font-bold">Patrocinado</span>
          <span className="text-muted-foreground"> · tumarca.cl</span>
        </p>
        <p className="text-sm font-medium text-[color:var(--brand-1)]">Tu marca | Agenda tu hora</p>
        <Bar w="95%" />
        <Bar w="70%" />
        <div className="flex gap-1.5 pt-1.5 text-[0.6rem] font-medium">
          {["Servicios", "Ubicación", "WhatsApp"].map((label) => (
            <span key={label} className="rounded-full border px-2 py-0.5">
              {label}
            </span>
          ))}
        </div>
      </div>
      {[2, 3].map((i) => (
        <div key={i} className="mk-loop mt-4 space-y-1.5" style={vars({ "--i": i })}>
          <Bar w="35%" />
          <Bar w="70%" className="bg-[color:var(--brand-1)]/25" />
          <Bar w="90%" />
        </div>
      ))}
    </div>
  );
}

/** Website wireframe: hero, sections and a WhatsApp button. */
function SiteMock() {
  return (
    <div className={cn(CARD, "relative w-full max-w-[340px] overflow-hidden")}>
      <div className="flex items-center gap-1.5 border-b px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-foreground/15" />
        ))}
        <span className="ml-2 flex-1 rounded-full bg-secondary px-2 py-0.5 text-[0.6rem] text-muted-foreground">
          tumarca.cl
        </span>
      </div>
      <div
        className="mk-loop space-y-2 p-4 text-white"
        style={{ ...vars({ "--i": 0 }), background: SWATCHES[0] }}
      >
        <p className="font-brand text-lg leading-tight">Tu marca</p>
        <Bar w="80%" className="bg-white/50" />
        <Bar w="55%" className="bg-white/50" />
        <span className="mt-1 inline-block rounded-full bg-white px-3 py-1 text-[0.6rem] font-semibold text-neutral-900">
          Escríbenos
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="mk-loop space-y-1.5" style={vars({ "--i": i })}>
            <span
              className="block aspect-square rounded-lg"
              style={{ background: SWATCHES[i + 1] }}
            />
            <Bar w="90%" />
            <Bar w="60%" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5 px-4 pb-5">
        <Bar w="40%" />
        <Bar w="85%" />
      </div>
      <span className="animate-gentle-float absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white shadow-lg">
        <WhatsAppGlyph className="h-5 w-5" />
      </span>
    </div>
  );
}

const CHAT: readonly { text: string; from: "client" | "bot" }[] = [
  { text: "Hola, ¿qué horarios tienen?", from: "client" },
  { text: "¡Hola! Te ayudo a agendar. Elige una opción:", from: "bot" },
];

/** WhatsApp conversation answered by an assistant, with quick replies. */
function ChatMock() {
  return (
    <div className={cn(CARD, "w-full max-w-[320px] overflow-hidden")}>
      <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2.5 text-white">
        <BrandAvatar />
        <div className="leading-tight">
          <p className="text-xs font-semibold">Tu marca</p>
          <p className="text-[0.6rem] opacity-80">en línea</p>
        </div>
      </div>
      <div className="space-y-2 bg-secondary/60 p-3 text-xs">
        {CHAT.map((m, i) => (
          <p
            key={m.text}
            className={cn(
              "mk-loop w-fit max-w-[85%] rounded-xl px-3 py-2 leading-snug shadow-sm",
              m.from === "client"
                ? "ml-auto rounded-tr-sm bg-[#25D366]/20"
                : "rounded-tl-sm bg-card",
            )}
            style={vars({ "--i": i * 2, "--gap": "0.5s" })}
          >
            {m.text}
          </p>
        ))}
        <div className="flex flex-wrap gap-1.5">
          {["Ver horarios", "Precios", "Hablar con una persona"].map((label, i) => (
            <span
              key={label}
              className="mk-loop rounded-full border border-[color:var(--brand-1)]/40 bg-card px-2.5 py-1 font-medium text-[color:var(--brand-1)]"
              style={vars({ "--i": 5 + i, "--gap": "0.5s" })}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Animated, decorative mockup for each service page hero. */
export function ServiceMockup({ slug }: { slug: ServiceSlug }) {
  switch (slug) {
    case "google-ads-pymes":
      return <SearchMock />;
    case "publicidad-meta-ads":
      return <AdCard className="animate-gentle-float w-full max-w-[260px]" />;
    case "pagina-web-para-pymes":
      return <SiteMock />;
    case "chatbot-whatsapp":
      return <ChatMock />;
    case "agencia-marketing-digital-santiago":
      return <PhoneFeed className="h-[380px] w-[188px]" />;
  }
}
