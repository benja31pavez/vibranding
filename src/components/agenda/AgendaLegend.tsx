import {
  AGENDA_KINDS,
  AGENDA_KIND_LABEL_PLURAL,
  POST_APPROVAL_LABEL,
  POST_APPROVAL_STATUSES,
} from "@/lib/agenda/types";
import { cn } from "@/lib/utils";
import { KIND_STYLE, POST_STATUS_STYLE } from "./agendaStyles";

/** Leyenda: cada tipo se identifica por ícono + nombre, el color es apoyo. */
export function AgendaLegend({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 text-xs", className)}>
      <div>
        <h3 id="agenda-legend-kinds" className="mb-1.5 font-medium text-muted-foreground">
          Tipos
        </h3>
        <ul aria-labelledby="agenda-legend-kinds" className="flex flex-wrap gap-x-3 gap-y-1.5">
          {AGENDA_KINDS.map((kind) => {
            const { icon: Icon, dot } = KIND_STYLE[kind];
            return (
              <li key={kind} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", dot)} />
                <Icon aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                {AGENDA_KIND_LABEL_PLURAL[kind]}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <h3 id="agenda-legend-posts" className="mb-1.5 font-medium text-muted-foreground">
          Publicaciones según aprobación
        </h3>
        <ul aria-labelledby="agenda-legend-posts" className="flex flex-wrap gap-x-3 gap-y-1.5">
          {[...POST_APPROVAL_STATUSES, "sin_estado" as const].map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("h-2.5 w-2.5 rounded-full", POST_STATUS_STYLE[status].dot)}
              />
              {POST_APPROVAL_LABEL[status]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
