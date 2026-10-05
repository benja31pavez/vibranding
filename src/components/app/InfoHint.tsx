import { useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface InfoHintProps {
  /** Texto de ayuda (puede llevar links). */
  children: ReactNode;
  /** Nombre accesible del botón. Por defecto "Más información". */
  label?: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

const HOVER_CLOSE_DELAY_MS = 120;

/**
 * Ícono "i" junto a un título que muestra un texto de ayuda. Es un botón real
 * (teclado y lectores de pantalla) y usa Popover, así que funciona con un toque
 * en móvil; con mouse también se abre al pasar por encima.
 */
export function InfoHint({
  children,
  label = "Más información",
  className,
  side = "top",
  align = "start",
}: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cancelClose();
    setOpen(true);
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          className={cn(
            "inline-grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Info aria-hidden className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-72 p-3 text-xs leading-relaxed text-muted-foreground shadow-app-lg"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
