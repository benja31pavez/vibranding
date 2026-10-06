import { useState } from "react";
import { initialsOf } from "@/components/shell/navConfig";
import { cn } from "@/lib/utils";
import { useClientLogo } from "./useClientLogos";

interface ClientLogoProps {
  clientId: string | null | undefined;
  name: string;
  /** Tamaño y estilo del recuadro con iniciales (el logo usa el mismo tamaño, redondo). */
  className?: string;
  /** Imagen previa si el cliente aún no tiene logo (p. ej. el avatar del editor de Instagram). */
  fallbackSrc?: string | null;
  /** Texto cuando no hay imagen. Por defecto, dos iniciales. */
  initials?: string;
  /** Sin logo no se muestra nada (en vez de iniciales). */
  hideFallback?: boolean;
  /** Vacío = decorativo (el nombre ya está al lado). */
  alt?: string;
}

/** Logo redondo del cliente (desde Instagram o subido) con iniciales de respaldo. */
export function ClientLogo({
  clientId,
  name,
  className,
  fallbackSrc,
  initials,
  hideFallback = false,
  alt = "",
}: ClientLogoProps) {
  const logo = useClientLogo(clientId);
  const src = logo?.url || fallbackSrc || null;
  // Si la imagen no carga (URL vieja, sin red), vuelven las iniciales.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && src !== brokenSrc;
  if (!showImage && hideFallback) return null;

  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden",
        className,
        showImage && "rounded-full bg-surface ring-1 ring-border-subtle",
      )}
    >
      {showImage && src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBrokenSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        (initials ?? initialsOf(name))
      )}
    </span>
  );
}
