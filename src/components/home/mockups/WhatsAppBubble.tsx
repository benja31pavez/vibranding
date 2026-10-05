import { cn } from "@/lib/utils";
import { WhatsAppGlyph } from "./parts";

/** WhatsApp notification: typing dots, then the customer's message pops in (loops). */
export function WhatsAppBubble({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-3 text-foreground shadow-xl", className)}>
      <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold text-muted-foreground">
        <WhatsAppGlyph className="h-3.5 w-3.5 text-[#25D366]" />
        WhatsApp · ahora
      </p>
      <div className="mt-2 grid">
        <p className="mk-msg [grid-area:1/1] rounded-xl rounded-tl-sm bg-[#25D366]/15 px-3 py-2 text-xs leading-snug">
          Hola, vi su anuncio, ¿tienen hora esta semana?
        </p>
        <span className="mk-dots [grid-area:1/1] flex gap-1 self-start justify-self-start rounded-xl rounded-tl-sm bg-secondary px-3 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
        </span>
      </div>
    </div>
  );
}
