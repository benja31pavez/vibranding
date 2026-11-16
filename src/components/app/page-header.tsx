import type { ReactNode } from "react";
import type { LinkProps } from "@tanstack/react-router";
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
  actions,
  className,
  size = "default",
}: PageHeaderProps) {
  const compact = size === "compact";
  return (
    <header className={cn("flex flex-col", compact ? "gap-1.5" : "gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className={cn("min-w-0", compact ? "space-y-0.5" : "space-y-1")}>
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground",
              compact ? "text-2xl" : "text-2xl md:text-3xl",
            )}
          >
            <TitleText title={title} />
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * Acento de marca del landing ("Lo que *hacemos por ti*"): la última palabra del título va en
 * Fraunces itálica con el degradado de marca. El texto y la jerarquía no cambian; los títulos
 * que no son texto plano se muestran tal cual.
 */
function TitleText({ title }: { title: ReactNode }) {
  if (typeof title !== "string") return <>{title}</>;
  const text = title.trim();
  const cut = text.lastIndexOf(" ") + 1;
  const accent = text.slice(cut);
  if (!accent) return <>{title}</>;
  return (
    <>
      {text.slice(0, cut)}
      <span className="font-brand text-gradient-brand-strong pe-[0.08em] leading-none dark:text-gradient-brand">
        {accent}
      </span>
    </>
  );
}

