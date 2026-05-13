import { Link } from "@tanstack/react-router";


export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-semibold text-xl tracking-tight">Vibranding</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-4 max-w-xs">
            Crecemos tu marca en Instagram y Meta Ads con estrategia, diseño y datos.
          </p>
        </div>

        <FooterCol title="Producto">
          <FooterLink href="/#servicios">Servicios</FooterLink>
          <FooterLink href="/#como">Cómo funciona</FooterLink>
          <FooterLink href="/#contacto">Contacto</FooterLink>
        </FooterCol>

        <FooterCol title="Recursos">
          <FooterLink to="/faq">Preguntas Frecuentes</FooterLink>
        </FooterCol>

        <FooterCol title="Legal">
          <FooterLink to="/terms">Términos de Servicio</FooterLink>
          <FooterLink to="/privacy">Política de Privacidad</FooterLink>
          <FooterLink to="/cookies">Cookies</FooterLink>
        </FooterCol>
      </div>
      <div className="border-t">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Vibranding. Todos los derechos reservados.
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
  return (
    <li>
      <a href={href} className="text-sm text-foreground/80 hover:text-foreground">
        {children}
      </a>
    </li>
  );
}
