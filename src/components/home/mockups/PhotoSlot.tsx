import { cn } from "@/lib/utils";
import type { PhotoSlotImage } from "./photo-slots";

const PHOTO_CLASS =
  "absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out motion-safe:group-hover:scale-105";

/**
 * Place for a photo (see photo-slots.ts). Several images cross-fade (static first image under
 * reduced motion). Without images it renders a soft brand gradient of the same size.
 */
export function PhotoSlot({
  images = [],
  sizes,
  tone = "var(--brand-1)",
  className,
  imageClassName,
  children,
}: {
  images?: readonly PhotoSlotImage[];
  sizes?: string;
  tone?: string;
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {images.length === 0 && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(70% 90% at 15% 10%, color-mix(in oklab, ${tone} 38%, transparent), transparent 70%), radial-gradient(60% 80% at 90% 100%, color-mix(in oklab, var(--brand-2) 26%, transparent), transparent 70%), color-mix(in oklab, ${tone} 8%, var(--card))`,
          }}
        />
      )}
      {images.map((image, i) => (
        <img
          key={image.src}
          src={image.src}
          srcSet={image.srcSet}
          sizes={sizes}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className={cn(PHOTO_CLASS, i > 0 && "mk-xfade", imageClassName)}
        />
      ))}
      {children}
    </div>
  );
}
