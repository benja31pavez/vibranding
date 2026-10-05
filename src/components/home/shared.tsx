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

type CtaVariant = "primary" | "outline" | "light";

const VARIANTS: Record<CtaVariant, string> = {
  primary:
    "bg-gradient-brand-strong text-white shadow-lg shadow-[color:var(--brand-2)]/25 hover:brightness-110",
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
}: {
  children: React.ReactNode;
  message?: string;
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
      onClick={() => trackLandingEvent("whatsapp_click", lang)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
