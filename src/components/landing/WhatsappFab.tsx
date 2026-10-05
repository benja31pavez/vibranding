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
      className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 rounded-full shadow-xl px-4 h-14 font-semibold transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        background: "#25D366",
        color: "#0a0a0a",
        outlineColor: "#128C7E",
        marginBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <MessageCircle className="w-6 h-6" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
