import { MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { TEAM, TEAM_ORDER, initials, type TeamMemberKey } from "@/lib/delivery/team";
import { whatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Qué hace cada integrante por la marca (una línea). */
const DOES: Readonly<Record<TeamMemberKey, string>> = {
  antonia: "Diseña tus piezas y tu marca",
  benjamin: "Estrategia, textos y campañas",
};

/**
 * "Tu equipo": Antonia y Benjamín con su rol, qué hacen por la marca y un
 * acceso directo a WhatsApp. Va en el encabezado del Resumen: no le quita
 * alto a las tarjetas (regla de una pantalla).
 */
export function TeamCard({ className }: { className?: string }) {
  const { client } = useActiveClient();
  const message = client
    ? `Hola, les escribo de ${client.name}. Tengo una consulta.`
    : "Hola, tengo una consulta.";
  return (
    <section
      aria-label="Tu equipo"
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-app-lg border border-border-subtle bg-surface px-3.5 py-2 shadow-app-xs",
        className,
      )}
    >
      <ul className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        {TEAM_ORDER.map((key) => {
          const m = TEAM[key];
          return (
            <li key={key} className="flex min-w-0 items-center gap-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <p className="whitespace-nowrap text-sm">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground"> · {m.role}</span>
                </p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">{DOES[key]}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <Button asChild size="sm" variant="outline" className="h-8 shrink-0 px-2.5 text-xs">
        <a
          href={whatsappUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          title="Escribir por WhatsApp"
        >
          <MessageCircle aria-hidden className="h-3.5 w-3.5 max-sm:mr-1.5 min-[1400px]:mr-1.5" />
          <span className="sr-only max-sm:not-sr-only min-[1400px]:not-sr-only">
            Escribir por WhatsApp
          </span>
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </Button>
    </section>
  );
}
