import { Link } from "@tanstack/react-router";
import { useLang } from "@/i18n/LanguageContext";
import { trackLandingEvent } from "@/lib/track";
import { SERVICE_LIST } from "@/lib/services/content";
import { LEGAL_NAME, LEGAL_RUT, WHATSAPP_DISPLAY, whatsappUrl } from "@/lib/site";

export function SiteFooter() {
  const { t, lang } = useLang();
  return (
    <footer className="border-t bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-10 py-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10">
        <div className="col-span-2 md:col-span-3 lg:col-span-1">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-brand text-3xl tracking-tight">Vibranding</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-4 max-w-xs">{t.footer.tagline}</p>
          <p className="text-sm text-muted-foreground mt-4">
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackLandingEvent("whatsapp_click", lang)}
              className="hover:text-foreground"
            >
              WhatsApp {WHATSAPP_DISPLAY}
            </a>
            <br />
            {t.footer.location}
          </p>
        </div>

        <nav aria-label="Servicios" className="col-span-2 md:col-span-1">
          {/* Spanish-only on purpose: these pages target searches in Chile. */}
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Servicios
          </h4>
          <ul className="space-y-3">
            {SERVICE_LIST.map((s) => (
              <FooterLink key={s.slug} to={s.path}>
                {s.navLabel}
              </FooterLink>
            ))}
          </ul>
        </nav>

        <FooterCol title={t.footer.columns.product}>
          <FooterLink href="/#servicios">{t.footer.links.services}</FooterLink>
          <FooterLink href="/#planes">{t.footer.links.plans}</FooterLink>
          <FooterLink href="/#como">{t.footer.links.how}</FooterLink>
          <FooterLink href="/#nosotros">{t.footer.links.about}</FooterLink>
          <FooterLink href="/#contacto" onClick={() => trackLandingEvent("contact_click", lang)}>{t.footer.links.contact}</FooterLink>
        </FooterCol>

        <FooterCol title={t.footer.columns.resources}>
          <FooterLink to="/faq">{t.footer.links.faq}</FooterLink>
          <FooterLink to="/login">{t.footer.links.clientAccess}</FooterLink>
        </FooterCol>

        <FooterCol title={t.footer.columns.legal}>
          <FooterLink to="/terms">{t.footer.links.terms}</FooterLink>
          <FooterLink to="/privacy">{t.footer.links.privacy}</FooterLink>
          <FooterLink to="/cookies">{t.footer.links.cookies}</FooterLink>
        </FooterCol>
      </div>
      <div className="border-t">
        {/* Extra bottom padding on mobile so the floating WhatsApp button never covers the legal line. */}
        <div className="max-w-7xl mx-auto px-4 md:px-10 pt-6 pb-24 md:pb-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {LEGAL_NAME} · RUT {LEGAL_RUT}. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{title}</h4>
      <ul className="space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({ to, href, children, onClick }: { to?: string; href?: string; children: React.ReactNode; onClick?: () => void }) {
  if (to) {
    return (
      <li>
        <Link to={to} onClick={onClick} className="text-sm text-foreground/80 hover:text-foreground">
          {children}
        </Link>
      </li>
    );
  }
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.();
    if (!href) return;
    const hashIdx = href.indexOf("#");
    if (hashIdx === -1) return;
    const id = href.slice(hashIdx + 1);
    const path = href.slice(0, hashIdx) || "/";
    if (typeof window !== "undefined" && window.location.pathname === path) {
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };
  return (
    <li>
      <a href={href} onClick={handleClick} className="text-sm text-foreground/80 hover:text-foreground">
        {children}
      </a>
    </li>
  );
}
