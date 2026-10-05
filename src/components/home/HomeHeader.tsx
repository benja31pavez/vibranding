import { Link } from "@tanstack/react-router";
import { stickyHeaderClass } from "./shared";
import { DiagnosticoLink } from "./GrowthSections";
import { useScrolled } from "@/hooks/use-motion";
import { translations } from "@/i18n/translations";

export function HomeHeader() {
  const t = translations.es; // The public home is Spanish-only (Chile).
  const nav = t.home.nav;
  const scrolled = useScrolled();
  const links = [
    { href: "#servicios", label: nav.services },
    { href: "#planes", label: nav.plans },
    { href: "#como", label: nav.how },
    { href: "#preguntas", label: nav.faq },
  ];

  return (
    <header className={stickyHeaderClass(scrolled)}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-10">
        <Link to="/" className="shrink-0" aria-label="Vibranding, inicio">
          <span className="font-brand text-2xl md:text-3xl tracking-tight text-gradient-brand-strong">
            Vibranding
          </span>
        </Link>
        <nav aria-label="Principal" className="hidden lg:flex items-center gap-7 text-sm">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-muted-foreground transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:text-foreground hover:after:scale-x-100 motion-reduce:after:transition-none"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3 md:gap-5">
          <Link
            to="/login"
            className="hidden sm:inline text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {nav.clientAccess}
          </Link>
          <DiagnosticoLink size="sm" cta="diagnostico:header">
            <span className="sm:hidden">{nav.ctaShort}</span>
            <span className="hidden sm:inline">{nav.cta}</span>
          </DiagnosticoLink>
        </div>
      </div>
    </header>
  );
}
