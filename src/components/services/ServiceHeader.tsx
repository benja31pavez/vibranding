import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { stickyHeaderClass, WhatsAppCta } from "@/components/home/shared";
import { useScrolled } from "@/hooks/use-motion";
import type { ServiceContent } from "@/lib/services/content";

export function ServiceHeader({ service }: { service: ServiceContent }) {
  const scrolled = useScrolled();
  return (
    <header className={stickyHeaderClass(scrolled)}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-10">
        <Link to="/" className="shrink-0" aria-label="Vibranding, inicio">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand-strong md:text-3xl">
            Vibranding
          </span>
        </Link>
        <WhatsAppCta size="sm" message={service.whatsappMessage}>
          <span className="sm:hidden">Cotizar</span>
          <span className="hidden sm:inline">Cotiza por WhatsApp</span>
        </WhatsAppCta>
      </div>
    </header>
  );
}

export function ServiceBreadcrumb({ service }: { service: ServiceContent }) {
  return (
    <nav aria-label="Migas de pan" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link to="/" className="underline-offset-4 hover:text-foreground hover:underline">
            Inicio
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="h-4 w-4" />
        </li>
        <li aria-current="page" className="text-foreground">
          {service.serviceName}
        </li>
      </ol>
    </nav>
  );
}
