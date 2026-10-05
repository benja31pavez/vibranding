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
      <div className="relative mx-auto h-[470px] w-[330px] select-none sm:h-[540px] sm:w-[400px]">
        <PhoneFeed className="absolute left-1/2 top-0 h-[460px] w-[226px] -translate-x-1/2 sm:h-[528px] sm:w-[260px]" />
        <div className="absolute bottom-2 left-0 w-[150px] sm:bottom-4 sm:w-[176px]">
          <AdCard className="animate-gentle-float" />
        </div>
        <div className="absolute right-0 top-14 w-[176px] sm:top-20 sm:w-[200px]">
          <WhatsAppBubble className="animate-gentle-float [animation-delay:-3.5s]" />
        </div>
      </div>
    </div>
  );
}
