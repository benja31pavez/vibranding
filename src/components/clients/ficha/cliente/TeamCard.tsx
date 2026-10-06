import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TEAM, TEAM_ORDER, initials, type TeamMemberKey } from "@/lib/delivery/team";
import { cn } from "@/lib/utils";

/** Qué hace cada integrante por la marca (una línea). */
const DOES: Readonly<Record<TeamMemberKey, string>> = {
  antonia: "Diseña tus piezas y tu marca",
  benjamin: "Estrategia, textos y campañas",
};

/**
 * "Tu equipo": Antonia y Benjamín con lo que hacen por la marca. Va en el
 * encabezado del Resumen: no le quita alto a las tarjetas (regla de una pantalla).
 */
export function TeamCard({ className }: { className?: string }) {
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
                <p className="whitespace-nowrap text-sm font-medium">{m.name}</p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">{DOES[key]}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
