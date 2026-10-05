import type { SVGProps } from "react";

/** Ícono actual de Reels en Instagram: cuadrado redondeado con triángulo de play. */
export function ReelsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      {...props}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <path
        d="M10 8.3v7.4a.6.6 0 0 0 .9.5l5.6-3.7a.6.6 0 0 0 0-1l-5.6-3.7a.6.6 0 0 0-.9.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Ícono de carrusel de Instagram: dos cuadrados redondeados superpuestos. */
export function CarouselIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M8 6.5V5a2.5 2.5 0 0 1 2.5-2.5H19A2.5 2.5 0 0 1 21.5 5v8.5A2.5 2.5 0 0 1 19 16h-1.5"
        strokeLinecap="round"
      />
      <rect x="2.5" y="8" width="13.5" height="13.5" rx="3" />
    </svg>
  );
}
