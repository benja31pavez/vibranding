import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { META_SCOPES } from "@/lib/meta/scopes";

/** Instrucciones a un clic, para no recargar el paso. */
export function HowTo({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-app-md border border-border-subtle bg-surface-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-app-md px-3 py-2 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ¿Cómo se hace?
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="space-y-3 px-3 pb-3 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Nombres técnicos de permisos, a un clic detrás de un ícono de información. */
export function ScopesInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ver permisos requeridos"
          className="text-muted-foreground transition hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 text-xs">
        <p className="font-medium text-foreground">Permisos requeridos en Meta</p>
        <div className="flex flex-wrap gap-1">
          {META_SCOPES.map((s) => (
            <code key={s} className="rounded bg-muted px-1.5 py-0.5">
              {s}
            </code>
          ))}
        </div>
        <p className="text-muted-foreground">
          Solo lectura de métricas de anuncios, página e Instagram. Nada se publica sin tu
          confirmación.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function Facts({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((l) => (
        <li key={l} className="flex gap-2">
          <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}
