import { MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TEAM, TEAM_ORDER, initials } from "@/lib/delivery/team";
import { whatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Equipo humano de Vibranding visible para el cliente (páginas públicas y
 * portal). Las fotos salen de `TEAM` (iniciales mientras no haya foto).
 */
export function TeamAvatars({ className }: { className?: string }) {
  return (
    <div className={cn("flex -space-x-2", className)} aria-hidden>
      {TEAM_ORDER.map((key) => {
        const m = TEAM[key];
        return (
          <Avatar key={key} className="h-9 w-9 ring-2 ring-surface">
            {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(m.name)}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

/** "Antonia, diseñadora, y Benjamín, publicista estratega". */
function teamLine(): string {
  return TEAM_ORDER.map((key) => `${TEAM[key].name}, ${TEAM[key].role.toLowerCase()}`).join(", y ");
}

/** Avatares + "Te acompañan …" (cabecera del onboarding). */
export function TeamIntro({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <TeamAvatars className="shrink-0" />
      <p className="text-sm text-muted-foreground">Te acompañan {teamLine()}.</p>
    </div>
  );
}

interface TeamContactProps {
  title: string;
  /** Mensaje con el que se abre WhatsApp. */
  whatsappMessage: string;
  buttonLabel?: string;
  className?: string;
}

/** Tarjeta "tu equipo": quiénes trabajan en tu marca y un acceso directo a WhatsApp. */
export function TeamContact({
  title,
  whatsappMessage,
  buttonLabel = "Escríbenos por WhatsApp",
  className,
}: TeamContactProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs sm:flex-row sm:items-center sm:justify-between sm:p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <TeamAvatars className="shrink-0" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Te acompañan {teamLine()}.</p>
        </div>
      </div>
      <Button asChild size="lg" variant="outline" className="shrink-0">
        <a href={whatsappUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden className="mr-2 h-4 w-4" />
          {buttonLabel}
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </Button>
    </section>
  );
}
