import { Signal, Wifi, BatteryFull, Grid3x3, User, Bookmark, Tag } from "lucide-react";
import type { IGProfile, IGPost } from "./InstagramEditor";

const fmt = (n: number | null) => {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
};

export function IphonePreview({
  profile,
  posts,
  view,
}: {
  profile: IGProfile;
  posts: IGPost[];
  view: "current" | "proposed";
}) {
  const pick = <T,>(p: T | null | undefined, c: T | null | undefined): T | null =>
    view === "proposed" ? ((p ?? c) as T | null) : ((c ?? null) as T | null);

  const username = pick(profile.proposed_username, profile.current_username) || "usuario";
  const avatar = pick(profile.proposed_avatar_url, profile.current_avatar_url);
  const bio = pick(profile.proposed_bio, profile.current_bio);
  const link = pick(profile.proposed_link, profile.current_link);
  const followers = pick(profile.proposed_followers, profile.current_followers);
  const following = pick(profile.proposed_following, profile.current_following);
  const postsCount = pick(profile.proposed_posts_count, profile.current_posts_count);

  const myPosts = posts
    .filter((p) => p.type === view)
    .sort((a, b) => a.position - b.position)
    .slice(0, 6);

  const time = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto" style={{ width: 320 }}>
      <div className="text-xs text-center text-muted-foreground mb-3 font-medium uppercase tracking-wider">
        {view === "proposed" ? "Propuesta" : "Actual"}
      </div>
      {/* iPhone frame */}
      <div className="relative rounded-[3rem] bg-black p-2 shadow-2xl">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-white" style={{ aspectRatio: "9/19.5" }}>
          {/* Dynamic island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-30" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-7 pt-3 pb-1 text-black text-[11px] font-semibold">
            <span>{time}</span>
            <div className="flex items-center gap-1">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <BatteryFull className="w-4 h-4" />
            </div>
          </div>

          {/* Instagram header */}
          <div className="flex items-center justify-between px-4 pt-6 pb-2">
            <div className="text-black font-semibold text-sm flex items-center gap-1">
              <span className="text-[15px]">{username}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
            </div>
            <div className="flex gap-3 text-black">
              <span className="text-lg leading-none">+</span>
              <span className="text-lg leading-none">≡</span>
            </div>
          </div>

          {/* Profile */}
          <div className="px-4">
            <div className="flex items-center gap-5">
              <div className="ig-ring p-[2px] rounded-full">
                <div className="bg-white p-[2px] rounded-full">
                  {avatar ? (
                    <img src={avatar} className="w-[72px] h-[72px] rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300" />
                  )}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-3 text-center text-black">
                <div>
                  <div className="font-semibold text-sm">{fmt(profile.current_posts_count)}</div>
                  <div className="text-[10px] text-zinc-600">posts</div>
                </div>
                <div>
                  <div className="font-semibold text-sm">{fmt(profile.current_followers)}</div>
                  <div className="text-[10px] text-zinc-600">seguidores</div>
                </div>
                <div>
                  <div className="font-semibold text-sm">{fmt(profile.current_following)}</div>
                  <div className="text-[10px] text-zinc-600">seguidos</div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-black text-[12px] leading-snug">
              {bio && <p className="whitespace-pre-line">{bio}</p>}
              {link && (
                <a className="text-[#00376b] font-medium block mt-0.5" href="#">
                  {link.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            <div className="flex gap-1.5 mt-3">
              <button className="flex-1 bg-[#0095f6] text-white text-[11px] font-semibold py-1.5 rounded-md">Seguir</button>
              <button className="flex-1 bg-zinc-100 text-black text-[11px] font-semibold py-1.5 rounded-md">Mensaje</button>
              <button className="bg-zinc-100 text-black px-2 py-1.5 rounded-md text-[11px]">▾</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 border-t border-zinc-200 flex text-zinc-500">
            <div className="flex-1 flex justify-center py-2 border-t-2 border-black -mt-px text-black">
              <Grid3x3 className="w-4 h-4" />
            </div>
            <div className="flex-1 flex justify-center py-2"><Bookmark className="w-4 h-4" /></div>
            <div className="flex-1 flex justify-center py-2"><Tag className="w-4 h-4" /></div>
            <div className="flex-1 flex justify-center py-2"><User className="w-4 h-4" /></div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-3 gap-[2px] bg-white">
            {Array.from({ length: 6 }).map((_, i) => {
              const p = myPosts.find((x) => x.position === i);
              return (
                <div key={i} className="aspect-square bg-zinc-100">
                  {p?.image_url && <img src={p.image_url} className="w-full h-full object-cover" alt="" />}
                </div>
              );
            })}
          </div>

          {/* Home indicator */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}
