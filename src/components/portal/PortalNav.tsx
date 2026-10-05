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
    <nav aria-label="Secciones del portal" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-subtle bg-surface px-3.5 text-sm font-medium hover:bg-surface-2"
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
