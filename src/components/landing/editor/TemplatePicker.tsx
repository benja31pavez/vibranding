import {
  Dumbbell,
  FileText,
  Home,
  Loader2,
  Stethoscope,
  Cake,
  type LucideIcon,
} from "lucide-react";
import { RUBRO_TEMPLATES, type RubroKey } from "@/lib/site/landingTemplates";

const RUBRO_ICON: Record<RubroKey, LucideIcon> = {
  hogar: Home,
  salud: Stethoscope,
  estetica: Dumbbell,
  pasteleria: Cake,
};

/**
 * Selector de plantilla por rubro. Cada plantilla trae textos de ejemplo
 * (marcados en el editor para reemplazar), servicios, FAQ y orden de secciones.
 */
export function TemplatePicker({
  onPick,
  busy,
  allowBlank = true,
}: {
  onPick: (key: RubroKey | null) => void;
  busy?: RubroKey | "blank" | null;
  allowBlank?: boolean;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {RUBRO_TEMPLATES.map((t) => {
        const Icon = RUBRO_ICON[t.key];
        return (
          <li key={t.key}>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => onPick(t.key)}
              className="group flex h-full w-full flex-col gap-3 rounded-2xl border bg-background p-4 text-left transition hover:border-foreground/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl text-white"
                  style={{ background: t.theme_color }}
                  aria-hidden="true"
                >
                  {busy === t.key ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </span>
                <span className="font-medium">{t.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">{t.examples}</span>
              <span className="mt-auto text-xs font-medium text-primary group-hover:underline">
                Usar esta plantilla
              </span>
            </button>
          </li>
        );
      })}
      {allowBlank && (
        <li>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => onPick(null)}
            className="flex h-full w-full flex-col gap-3 rounded-2xl border border-dashed bg-background p-4 text-left transition hover:border-foreground/40 disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 place-items-center rounded-xl bg-secondary"
                aria-hidden="true"
              >
                {busy === "blank" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </span>
              <span className="font-medium">En blanco</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Sólo el nombre del cliente; completas todo a mano.
            </span>
          </button>
        </li>
      )}
    </ul>
  );
}
