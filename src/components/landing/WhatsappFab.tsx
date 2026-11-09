import { MessageCircle } from "lucide-react";

/**
 * Botón flotante de WhatsApp con el mensaje precargado. Siempre visible en
 * móvil (es el canal de venta principal de una pyme chilena).
 */
export function WhatsappFab({
  href,
  label,
  onClick,
}: {
  href: string | null;
  label: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      aria-label={label}
      className="group fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center justify-center gap-2 rounded-full w-14 sm:w-auto sm:pl-4 sm:pr-5 h-14 font-semibold transition motion-safe:hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500"
      style={{
        background: "#25D366",
        color: "#0a0a0a",
        outlineColor: "#128C7E",
        marginBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 14px 30px -10px rgba(18,140,126,0.65), 0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      <MessageCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
