import { Signal, Wifi, BatteryFull, Grid3x3, User, Bookmark, Tag, Layers, Film, Plus, BadgeCheck, Music2, AtSign, Lock, FlaskConical } from "lucide-react";
import type { IGProfile, IGPost, IGHighlight } from "./InstagramEditor";

const fmt = (n: number | null) => {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
};

export function IphonePreview({
  profile,
  posts,
  highlights,
  view,
}: {
  profile: IGProfile;
  posts: IGPost[];
  highlights: IGHighlight[];
  view: "current" | "proposed";
}) {
  const pick = <T,>(p: T | null | undefined, c: T | null | undefined): T | null =>
    view === "proposed" ? ((p ?? c) as T | null) : ((c ?? null) as T | null);
  const pickBool = (p: boolean, c: boolean) => (view === "proposed" ? p : c);

  const username = pick(profile.proposed_username, profile.current_username) || "usuario";
  const avatar = pick(profile.proposed_avatar_url, profile.current_avatar_url);
  const bio = pick(profile.proposed_bio, profile.current_bio);
  const link = pick(profile.proposed_link, profile.current_link);
  const followers = pick(profile.proposed_followers, profile.current_followers);
  const following = pick(profile.proposed_following, profile.current_following);
  const postsCount = pick(profile.proposed_posts_count, profile.current_posts_count);
  const accountType = view === "proposed" ? profile.proposed_account_type : profile.current_account_type;
  const category = view === "proposed" ? profile.proposed_category : profile.current_category;
  const verified = pickBool(profile.proposed_verified, profile.current_verified);
  const threadsEnabled = pickBool(profile.proposed_threads_enabled, profile.current_threads_enabled);
  const threadsHandle = pick(profile.proposed_threads_handle, profile.current_threads_handle);
  const songEnabled = pickBool(profile.proposed_song_enabled, profile.current_song_enabled);
  const song = pick(profile.proposed_song, profile.current_song);

  const myPosts = posts
    .filter((p) => p.type === view)
    .sort((a, b) => a.position - b.position)
    .slice(0, 6);

  const myHighlights = highlights
    .filter((h) => h.type === view)
    .sort((a, b) => a.position - b.position);

  const time = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto" style={{ width: 320 }}>
      <div className="text-xs text-center text-muted-foreground mb-3 font-medium uppercase tracking-wider">
        {view === "proposed" ? "Propuesta" : "Actual"}
      </div>
      <div className="relative rounded-[3rem] bg-black p-2 shadow-2xl">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-white" style={{ aspectRatio: "9/19.5" }}>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-30" />

          <div className="flex items-center justify-between px-7 pt-3 pb-1 text-black text-[11px] font-semibold">
            <span>{time}</span>
            <div className="flex items-center gap-1">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <BatteryFull className="w-4 h-4" />
            </div>
          </div>

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
                  <div className="font-semibold text-sm">{fmt(postsCount)}</div>
                  <div className="text-[10px] text-zinc-600">posts</div>
                </div>
                <div>
                  <div className="font-semibold text-sm">{fmt(followers)}</div>
                  <div className="text-[10px] text-zinc-600">seguidores</div>
                </div>
                <div>
                  <div className="font-semibold text-sm">{fmt(following)}</div>
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

            {/* Highlights */}
            {(myHighlights.length > 0) && (
              <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto pb-1">
                {myHighlights.map((h) => (
                  <div key={h.id} className="flex flex-col items-center flex-shrink-0 w-14">
                    <div className="w-12 h-12 rounded-full border border-zinc-300 p-[2px] bg-white">
                      {h.cover_url ? (
                        <img src={h.cover_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-zinc-100" />
                      )}
                    </div>
                    <div className="text-[9px] text-black mt-1 truncate w-full text-center">
                      {h.title || "Destacada"}
                    </div>
                  </div>
                ))}
                <div className="flex flex-col items-center flex-shrink-0 w-14">
                  <div className="w-12 h-12 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-500">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-1">Nueva</div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-zinc-200 flex text-zinc-500">
            <div className="flex-1 flex justify-center py-2 border-t-2 border-black -mt-px text-black">
              <Grid3x3 className="w-4 h-4" />
            </div>
            <div className="flex-1 flex justify-center py-2"><Bookmark className="w-4 h-4" /></div>
            <div className="flex-1 flex justify-center py-2"><Tag className="w-4 h-4" /></div>
            <div className="flex-1 flex justify-center py-2"><User className="w-4 h-4" /></div>
          </div>

          <div className="grid grid-cols-3 gap-[2px] bg-white">
            {Array.from({ length: 6 }).map((_, i) => {
              const p = myPosts.find((x) => x.position === i);
              const Icon = p?.format === "reel" ? Film : p?.format === "carousel" ? Layers : null;
              const thumb = p?.format === "reel" ? (p.cover_url || p.image_url) : p?.image_url;
              return (
                <div key={i} className="aspect-square bg-zinc-100 relative">
                  {thumb && <img src={thumb} className="w-full h-full object-cover" alt="" />}
                  {Icon && (
                    <div className="absolute top-1 right-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                      <Icon className="w-3.5 h-3.5" fill="white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}
