import { Link } from "@tanstack/react-router";
import { useLang } from "@/i18n/LanguageContext";

export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="border-t bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-brand text-3xl tracking-tight">Vibranding</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-4 max-w-xs">{t.footer.tagline}</p>
        </div>

        <FooterCol title={t.footer.columns.product}>
          <FooterLink href="/#servicios">{t.footer.links.services}</FooterLink>
          <FooterLink href="/#como">{t.footer.links.how}</FooterLink>
          <FooterLink href="/#contacto">{t.footer.links.contact}</FooterLink>
        </FooterCol>

        <FooterCol title={t.footer.columns.resources}>
          <FooterLink to="/faq">{t.footer.links.faq}</FooterLink>
        </FooterCol>

        <FooterCol title={t.footer.columns.legal}>
          <FooterLink to="/terms">{t.footer.links.terms}</FooterLink>
          <FooterLink to="/privacy">{t.footer.links.privacy}</FooterLink>
          <FooterLink to="/cookies">{t.footer.links.cookies}</FooterLink>
        </FooterCol>
      </div>
      <div className="border-t">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Vibranding. {t.footer.rights}
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

function FooterLink({ to, href, children }: { to?: string; href?: string; children: React.ReactNode }) {
  if (to) {
    return (
      <li>
        <Link to={to} className="text-sm text-foreground/80 hover:text-foreground">
          {children}
        </Link>
      </li>
    );
  }
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
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
