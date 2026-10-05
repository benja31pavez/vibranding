import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Ruta tipada del router sin parámetros (p. ej. "/clients"). Sin `to`, es la página actual. */
  to?: LinkProps["to"];
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Botones u otras acciones alineadas a la derecha. */
  actions?: ReactNode;
  breadcrumb?: readonly BreadcrumbItem[];
  className?: string;
  /** "compact": título más chico para pantallas que caben en una sola vista (FitPage). */
  size?: "default" | "compact";
}

/** Encabezado estándar de una pantalla de la plataforma. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
  size = "default",
}: PageHeaderProps) {
  const compact = size === "compact";
  return (
    <header className={cn("flex flex-col", compact ? "gap-1.5" : "gap-3", className)}>
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className={cn("min-w-0", compact ? "space-y-0.5" : "space-y-1")}>
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground",
              compact ? "text-2xl" : "text-2xl md:text-3xl",
            )}
          >
            {title}
          </h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

function Breadcrumb({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="rounded-app-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "text-foreground" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight aria-hidden className="h-3 w-3" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
