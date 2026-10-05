import { MessageCircle } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { trackLandingEvent } from "@/lib/track";
import { whatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  accent,
  end = "",
  subtitle,
  id,
  align = "center",
}: {
  title: string;
  accent: string;
  end?: string;
  subtitle?: string;
  id?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      data-reveal
      className={cn(
        "mb-10 md:mb-14",
        align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-xl",
      )}
    >
      <h2
        id={id}
        className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1] text-balance"
      >
        {title} <span className="font-brand text-gradient-brand-strong">{accent}</span>
        {end}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base md:text-lg text-muted-foreground text-pretty">{subtitle}</p>
      )}
    </div>
  );
}

/** Sticky header surface: light and see-through at the top, solid with blur once scrolled. */
export function stickyHeaderClass(scrolled: boolean): string {
  return cn(
    "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none",
    scrolled
      ? "border-border/60 bg-background/80 shadow-[0_8px_24px_-18px_rgb(0_0_0/0.25)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70"
      : "border-transparent bg-background/40 backdrop-blur-sm",
  );
}

type CtaVariant = "primary" | "outline" | "light";

const VARIANTS: Record<CtaVariant, string> = {
  primary:
    "btn-shine bg-gradient-brand-strong text-white shadow-lg shadow-[color:var(--brand-2)]/25 hover:brightness-110",
  outline: "border border-foreground/15 bg-background text-foreground hover:bg-secondary",
  light: "bg-white text-[oklch(0.25_0.05_265)] hover:bg-white/90",
};

/** Anchor that opens WhatsApp with a pre-filled message and tracks the click. */
export function WhatsAppCta({
  children,
  message,
  variant = "primary",
  size = "lg",
  className,
  cta = "whatsapp",
}: {
  children: React.ReactNode;
  message?: string;
  /** Id del botón para Estadísticas (p. ej. "plan:crecimiento"). */
  cta?: string;
  variant?: CtaVariant;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { lang } = useLang();
  return (
    <a
      href={whatsappUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackLandingEvent("whatsapp_click", lang, cta)}
      className={cn(
        "btn-fx inline-flex items-center justify-center gap-2 rounded-full font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        size === "lg" ? "h-12 px-7 text-base" : "h-10 px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
    >
      <MessageCircle aria-hidden className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      {children}
    </a>
  );
}
