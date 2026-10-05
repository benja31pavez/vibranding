import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#pendientes", label: "Por aprobar" },
  { href: "#calendario", label: "Calendario" },
  { href: "#resultados", label: "Resultados" },
  { href: "#pagos", label: "Pagos" },
  { href: "#propuestas", label: "Propuestas" },
] as const;

/** Atajos a cada sección; en móvil se desplaza horizontalmente sin romper el ancho. */
export function PortalNav({ pending }: { pending: number }) {
  return (
    <nav
      aria-label="Secciones del portal"
      className="sticky top-14 z-20 -mx-4 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur [scrollbar-width:none] md:top-16 md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium shadow-app-xs transition-colors",
                link.href === "#pendientes" && pending > 0
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-border-subtle bg-surface text-foreground hover:bg-surface-2",
              )}
            >
              {link.label}
              {link.href === "#pendientes" && pending > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {pending}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
