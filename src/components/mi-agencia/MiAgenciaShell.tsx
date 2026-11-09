import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, Landmark, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pestañas superiores propias de la zona "Mi agencia". No usan `SectionTabs` del
 * cliente porque no son subsecciones de una página: son las cuatro secciones de
 * una zona nueva (con `Link` reales, no state). Cada enlace lleva a su ruta.
 *
 * En teléfono se convierten en una fila con scroll horizontal; nada queda fuera
 * de pantalla (prueba a 360/390/430 px).
 */

export interface MiAgenciaSection {
  key: "panel" | "finanzas" | "equipo" | "empresa";
  label: string;
  to: "/mi-agencia" | "/mi-agencia/finanzas" | "/mi-agencia/equipo" | "/mi-agencia/empresa";
  icon: typeof LayoutDashboard;
}

export const MI_AGENCIA_SECTIONS: readonly MiAgenciaSection[] = [
  { key: "panel", label: "Panel", to: "/mi-agencia", icon: LayoutDashboard },
  { key: "finanzas", label: "Finanzas", to: "/mi-agencia/finanzas", icon: Landmark },
  { key: "equipo", label: "Equipo", to: "/mi-agencia/equipo", icon: Users },
  { key: "empresa", label: "Empresa", to: "/mi-agencia/empresa", icon: Building2 },
];

export function MiAgenciaTopNav({ active }: { active: MiAgenciaSection["key"] }) {
  return (
    <nav
      aria-label="Secciones de Mi agencia"
      className="flex overflow-x-auto rounded-app-md border border-border-subtle bg-surface p-1 shadow-app-xs"
    >
      {MI_AGENCIA_SECTIONS.map((s) => {
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            to={s.to}
            className={cn(
              "flex min-w-fit flex-1 items-center justify-center gap-2 rounded-app-sm px-3 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              isActive
                ? "bg-brand-soft text-brand-1"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <s.icon aria-hidden className="h-4 w-4" />
            <span>{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Migas de pan de la zona "Mi agencia": los enlaces /mi-agencia, /mi-agencia/<x>
 * son rutas reales, así que las armamos manualmente igual que en $clientId.tsx.
 */
export function MiAgenciaBreadcrumb({ section }: { section: MiAgenciaSection }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isPanel = section.key === "panel" && (path === "/mi-agencia" || path === "/mi-agencia/");
  return (
    <nav
      aria-label="Ruta de navegación"
      className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
    >
      {isPanel ? (
        <span aria-current="page" className="font-medium text-foreground">
          Mi agencia
        </span>
      ) : (
        <>
          <Link to="/mi-agencia" className="rounded-app-sm hover:text-foreground">
            Mi agencia
          </Link>
          <span aria-hidden>›</span>
          <span aria-current="page" className="font-medium text-foreground">
            {section.label}
          </span>
        </>
      )}
    </nav>
  );
}

export interface MiAgenciaPageProps {
  section: MiAgenciaSection["key"];
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function MiAgenciaPage({
  section,
  title,
  description,
  actions,
  children,
}: MiAgenciaPageProps) {
  const current = MI_AGENCIA_SECTIONS.find((s) => s.key === section)!;
  return (
    <div className="flex w-full max-w-[1600px] flex-col gap-4 px-4 py-6 md:px-10 md:py-8">
      <div className="flex flex-col gap-3">
        <MiAgenciaBreadcrumb section={current} />
        <MiAgenciaTopNav active={section} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
