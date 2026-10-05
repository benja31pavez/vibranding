import {
  Bell,
  ChevronDown,
  ChevronLeft,
  Clapperboard,
  Copy,
  Ellipsis,
  Grid3x3,
  SquareUser,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BrandAvatar } from "./parts";
import { SWATCHES, vars } from "./tokens";

const STATS = ["publicaciones", "seguidores", "seguidos"];
const HIGHLIGHTS = ["Servicios", "Precios", "Equipo", "Ubicación", "Opiniones"];
/** Swatch per grid post, in grid order; the first one is the post that gets published. */
const POSTS = [0, 3, 1, 5, 2, 4, 1, 0, 3, 5, 4, 2];
/** Corner badge per post (reel / carousel), like the real grid. */
const BADGES: Partial<Record<number, "reel" | "carousel">> = {
  2: "reel",
  4: "carousel",
  7: "reel",
};
const GRID_COLS = 3;
const GRID_GAP = "1px";

/**
 * Where a grid post sat before the new one was published: one cell back (the previous row's
 * last cell for posts in the first column). The animation slides each post from there to its
 * final cell, which is the static frame.
 */
function previousCell(index: number): React.CSSProperties {
  const firstColumn = index % GRID_COLS === 0;
  return vars({
    "--sx": firstColumn
      ? `calc(${(GRID_COLS - 1) * 100}% + ${GRID_COLS - 1} * ${GRID_GAP})`
      : `calc(-100% - ${GRID_GAP})`,
    "--sy": firstColumn ? `calc(-100% - ${GRID_GAP})` : "0px",
  });
}

function PostTile({ index }: { index: number }) {
  const isNew = index === 0;
  const badge = BADGES[index];
  return (
    <span
      className={cn("relative aspect-square", isNew ? "mk-ig-new" : "mk-ig-shift")}
      style={{ ...(isNew ? {} : previousCell(index)), background: SWATCHES[POSTS[index]] }}
    >
      {badge === "reel" && (
        <Clapperboard className="absolute right-1 top-1 h-2.5 w-2.5 text-white" />
      )}
      {badge === "carousel" && <Copy className="absolute right-1 top-1 h-2.5 w-2.5 text-white" />}
    </span>
  );
}

/**
 * Phone with an Instagram profile for the fictional brand "Tu marca", as a visitor sees it.
 * Loop: a new post lands in the first grid cell (the rest shift one cell), then "Seguir" is
 * tapped and shows "Siguiendo" for a few seconds.
 * No real metrics: the counters are skeleton bars.
 */
export function PhoneFeed({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[2.4rem] bg-neutral-900 p-2 shadow-2xl shadow-[color:var(--brand-2)]/25 ring-1 ring-black/10",
        className,
      )}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-card text-left text-foreground">
        <span className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-neutral-900" />
        <div className="flex items-center gap-2 px-3 pb-2 pt-8">
          <ChevronLeft className="h-4 w-4" />
          <span className="flex-1 text-[0.8rem] font-bold">tumarca</span>
          <Bell className="h-3.5 w-3.5" />
          <Ellipsis className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 px-3 sm:gap-3">
          <BrandAvatar size="h-14 w-14 text-2xl" />
          <div className="grid flex-1 grid-cols-3 text-center">
            {STATS.map((label) => (
              <span key={label} className="flex flex-col items-center gap-1">
                <Bar w="1.1rem" className="h-2 bg-foreground/25" />
                <span className="text-[0.42rem] leading-none tracking-tight text-foreground/80 sm:text-[0.5rem] sm:tracking-normal">
                  {label}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1 px-3 pt-2">
          <p className="text-[0.65rem] font-semibold leading-none">Tu marca</p>
          <p className="text-[0.55rem] leading-none text-muted-foreground">Negocio local</p>
          <Bar w="88%" />
          <Bar w="62%" />
          <p className="text-[0.55rem] font-semibold leading-none text-[#00376B] dark:text-[#E0F1FF]">
            tumarca.cl
          </p>
        </div>
        <div className="flex gap-1 px-3 pt-2.5 text-[0.6rem] font-semibold">
          <span className="mk-ig-follow relative flex-1">
            <span className="mk-ig-seguir block rounded-md bg-[#0095F6] py-1 text-center text-white">
              Seguir
            </span>
            <span className="mk-ig-siguiendo absolute inset-0 flex items-center justify-center gap-0.5 rounded-md bg-secondary text-foreground">
              Siguiendo
              <ChevronDown className="h-2.5 w-2.5" />
            </span>
          </span>
          <span className="flex-1 rounded-md bg-secondary py-1 text-center">Mensaje</span>
          <span className="grid place-items-center rounded-md bg-secondary px-1.5">
            <UserPlus className="h-3 w-3" />
          </span>
        </div>
        <div className="flex justify-between px-3 pt-3">
          {HIGHLIGHTS.map((label, i) => (
            <span key={label} className="flex w-[2.1rem] flex-col items-center gap-1 sm:w-10">
              <span className="rounded-full p-[2px] ring-1 ring-foreground/20">
                <span
                  className="block h-7 w-7 rounded-full sm:h-8 sm:w-8"
                  style={{ background: SWATCHES[(i + 1) % SWATCHES.length] }}
                />
              </span>
              <span className="w-full truncate text-center text-[0.4rem] leading-none sm:text-[0.45rem]">
                {label}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-3 border-b border-foreground/10 text-foreground/45">
          <span className="flex justify-center border-b border-foreground py-1.5 text-foreground">
            <Grid3x3 className="h-3.5 w-3.5" />
          </span>
          <span className="flex justify-center py-1.5">
            <Clapperboard className="h-3.5 w-3.5" />
          </span>
          <span className="flex justify-center py-1.5">
            <SquareUser className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mk-ig-grid grid grid-cols-3 gap-px pt-px">
          {POSTS.map((swatch, i) => (
            <PostTile key={`${swatch}-${i}`} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
