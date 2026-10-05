import { cn } from "@/lib/utils";

/** Skeleton text line. */
export function Bar({ w, className }: { w: string; className?: string }) {
  return (
    <span
      className={cn("block h-1.5 rounded-full bg-foreground/10", className)}
      style={{ width: w }}
    />
  );
}

/** "Tu marca" avatar with the Instagram-style gradient ring. */
export function BrandAvatar({ size = "h-7 w-7" }: { size?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-brand p-[2px]",
        size,
      )}
    >
      <span className="grid h-full w-full place-items-center rounded-full border-2 border-card bg-gradient-brand-strong font-brand text-[0.6em] text-white">
        T
      </span>
    </span>
  );
}

/** Small WhatsApp glyph (inline SVG, no icon dependency). */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}
