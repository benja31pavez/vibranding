import { cn } from "@/lib/utils";
import { Bar, BrandAvatar, WhatsAppGlyph } from "./parts";
import { SWATCHES } from "./tokens";

/** Meta-style sponsored post ("Patrocinado") for "Tu marca". */
export function AdCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card text-foreground shadow-xl",
        className,
      )}
    >
      <div className="flex items-center gap-2 p-2.5">
        <BrandAvatar />
        <div className="leading-tight">
          <p className="text-[0.7rem] font-semibold">Tu marca</p>
          <p className="text-[0.6rem] text-muted-foreground">Patrocinado</p>
        </div>
      </div>
      <div className="relative aspect-[5/4]" style={{ background: SWATCHES[1] }}>
        <span className="absolute -left-4 bottom-3 h-20 w-20 rounded-full bg-white/20" />
        <span className="absolute right-3 top-3 rounded-full bg-white/85 px-2 py-0.5 text-[0.6rem] font-semibold text-neutral-900">
          Agenda tu hora
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 p-2.5">
        <div className="flex-1 space-y-1.5">
          <Bar w="80%" />
          <Bar w="55%" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[0.6rem] font-semibold">
          <WhatsAppGlyph className="h-3 w-3 text-[#25D366]" />
          Enviar mensaje
        </span>
      </div>
    </div>
  );
}
