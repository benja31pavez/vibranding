import { AdCard } from "./AdCard";
import { PhoneFeed } from "./PhoneFeed";
import { WhatsAppBubble } from "./WhatsAppBubble";

/**
 * Home hero visual: phone with the brand's feed, a floating Meta ad and a WhatsApp message.
 * Purely decorative; the fixed box reserves its space so nothing shifts while it animates.
 */
export function HeroShowcase({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div aria-hidden className={className} style={style}>
      {/*
        The phone sits left of center so both cards can float off its right edge: the WhatsApp
        bubble overlaps only the bezel (never the profile header) and the ad card leaves the
        grid's first cell (where new posts land) in view. On mobile the box is a bit taller so the
        floating ad stays below the five story highlights.
      */}
      <div className="relative mx-auto h-[500px] w-[343px] select-none sm:h-[540px] sm:w-[440px]">
        <PhoneFeed className="absolute left-0 top-0 h-[460px] w-[226px] sm:left-2.5 sm:h-[528px] sm:w-[260px]" />
        <div className="absolute bottom-0 right-0 w-[150px] sm:bottom-4 sm:right-6 sm:w-[176px]">
          <AdCard className="animate-gentle-float" />
        </div>
        <div className="absolute right-0 top-6 w-[140px] sm:top-6 sm:w-[190px]">
          <WhatsAppBubble className="animate-gentle-float [animation-delay:-3.5s]" />
        </div>
      </div>
    </div>
  );
}
