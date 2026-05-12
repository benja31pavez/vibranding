import { useState } from "react";
import { Signal, Wifi, BatteryFull, Grid3x3, Layers, Film, BadgeCheck, Play, AtSign, Star, FlaskConical, Repeat, SquareUser, Link as LinkIcon, PlaySquare, Phone, Mail, X, Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
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
  const displayName = pick(profile.proposed_display_name, profile.current_display_name);
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
  const showContact = pickBool(profile.proposed_show_contact_button, profile.current_show_contact_button);
  const contactPhone = pick(profile.proposed_contact_phone, profile.current_contact_phone);
  const contactEmail = pick(profile.proposed_contact_email, profile.current_contact_email);

  const myPosts = posts
    .filter((p) => p.type === view)
    .sort((a, b) => a.position - b.position);

  const myHighlights = highlights
    .filter((h) => h.type === view)
    .sort((a, b) => a.position - b.position);

  const reels = myPosts.filter((p) => p.format === "reel");
  const gridCount = Math.max(0, Math.min(30, postsCount ?? 6));

  const time = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  const [tab, setTab] = useState<"grid" | "reels" | "tagged" | "reposts">("grid");
  const [contactOpen, setContactOpen] = useState(false);
  const [storyHighlight, setStoryHighlight] = useState<IGHighlight | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);

  return (
    <div className="mx-auto" style={{ width: 320 }}>
      <div className="text-xs text-center text-muted-foreground mb-3 font-medium uppercase tracking-wider">
        {view === "proposed" ? "Propuesta" : "Actual"}
      </div>
      <div className="relative rounded-[3rem] bg-black p-2 shadow-2xl">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-white" style={{ aspectRatio: "9/19.5" }}>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-30" />

          <div className="absolute inset-0 flex flex-col">
            <div className="flex items-center justify-between px-7 pt-3 pb-1 text-black text-[11px] font-semibold shrink-0">
              <span>{time}</span>
              <div className="flex items-center gap-1">
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <BatteryFull className="w-4 h-4" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          <div className="flex items-center justify-between px-4 pt-6 pb-2">
            <div className="text-black font-semibold text-sm flex items-center gap-1">
              <span className="text-[15px]">{username}</span>
              {verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0095f6]" fill="#0095f6" stroke="white" />}
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

            <div className="mt-3 text-black text-[12px] leading-snug space-y-0.5">
              {displayName && <p className="font-semibold">{displayName}</p>}
              {accountType === "business" && category && (
                <p className="text-[11px] text-zinc-600">{category}</p>
              )}
              {bio && <p className="whitespace-pre-line">{bio}</p>}
              {link && (
                <a className="text-[#00376b] font-medium inline-flex items-center gap-1" href="#">
                  <LinkIcon className="w-3 h-3" />
                  <span>{link.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
              {((threadsEnabled && threadsHandle) || (songEnabled && song)) && (
                <div className="flex items-center gap-3 text-[11px] text-zinc-700 flex-wrap">
                  {threadsEnabled && threadsHandle && (
                    <span className="inline-flex items-center gap-1">
                      <AtSign className="w-3 h-3" />
                      <span>{threadsHandle.replace(/^@/, "")}</span>
                    </span>
                  )}
                  {songEnabled && song && (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <Play className="w-3 h-3 shrink-0" fill="currentColor" />
                      <span className="truncate">{song}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-1.5 mt-3">
              <button className="flex-1 bg-[#0095f6] text-white text-[11px] font-semibold py-1.5 rounded-md">Seguir</button>
              <button className="flex-1 bg-zinc-100 text-black text-[11px] font-semibold py-1.5 rounded-md">Mensaje</button>
              {showContact && (
                <button
                  type="button"
                  onClick={() => setContactOpen((v) => !v)}
                  className="flex-1 bg-zinc-100 text-black text-[11px] font-semibold py-1.5 rounded-md"
                >
                  Contactar
                </button>
              )}
              <button className="bg-zinc-100 text-black px-2 py-1.5 rounded-md text-[11px]">▾</button>
            </div>

            {showContact && contactOpen && (
              <div className="mt-2 rounded-md border border-zinc-200 bg-white text-black text-[11px] divide-y divide-zinc-100 shadow-sm">
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Información de contacto</span>
                  <button onClick={() => setContactOpen(false)} aria-label="Cerrar">
                    <X className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
                <div className="px-3 py-2 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{contactPhone || <span className="text-zinc-400">Sin teléfono</span>}</span>
                </div>
                <div className="px-3 py-2 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{contactEmail || <span className="text-zinc-400">Sin correo</span>}</span>
                </div>
              </div>
            )}

            {/* Highlights — 5 perfect circles */}
            <div className="mt-3 grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const h = myHighlights[i];
                return (
                  <button
                    key={h?.id ?? i}
                    type="button"
                    disabled={!h}
                    onClick={() => {
                      if (!h) return;
                      setStoryHighlight(h);
                      setStoryIndex(0);
                    }}
                    className="flex flex-col items-center min-w-0 disabled:cursor-default"
                  >
                    <div className="w-12 h-12 rounded-full border border-zinc-300 p-[2px] bg-white">
                      {h?.cover_url ? (
                        <img src={h.cover_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-zinc-100" />
                      )}
                    </div>
                    <div className="text-[9px] text-black mt-1 truncate w-full text-center leading-tight">
                      {h?.title || ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 border-t border-zinc-200 flex text-zinc-500">
            {([
              { key: "grid", Icon: Grid3x3 },
              { key: "reels", Icon: PlaySquare },
              { key: "reposts", Icon: Repeat },
              { key: "tagged", Icon: SquareUser },
            ] as const).map(({ key, Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex-1 flex justify-center py-2 -mt-px ${active ? "border-t-2 border-black text-black" : ""}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {tab === "grid" && (
            <div className="grid grid-cols-3 gap-[2px] bg-white">
              {Array.from({ length: gridCount }).map((_, i) => {
                const p = myPosts.find((x) => x.position === i);
                const Icon = p?.format === "reel" ? Film : p?.format === "carousel" ? Layers : null;
                const thumb = p?.format === "reel" ? (p.cover_url || p.image_url) : p?.image_url;
                return (
                  <div key={i} className="bg-zinc-100 relative" style={{ aspectRatio: "3/4" }}>
                    {thumb && <img src={thumb} className="w-full h-full object-cover" alt="" />}
                    {p?.close_friends_only && (
                      <div className="absolute top-1 left-1 bg-[#1c8c5b] text-white rounded-full p-[2px] drop-shadow">
                        <Lock className="w-2.5 h-2.5" />
                      </div>
                    )}
                    {p?.format === "reel" && p?.is_trial_reel && (
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-semibold px-1 py-[1px] rounded flex items-center gap-0.5">
                        <FlaskConical className="w-2.5 h-2.5" /> Prueba
                      </div>
                    )}
                    {Icon && (
                      <div className="absolute top-1 right-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                        <Icon className="w-3.5 h-3.5" fill="white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "reels" && (
            <div className="grid grid-cols-3 gap-[2px] bg-white">
              {reels.length === 0 && (
                <div className="col-span-3 text-center text-[10px] text-zinc-400 py-8">
                  Sin reels aún
                </div>
              )}
              {reels.map((p) => {
                const thumb = p.cover_url || p.image_url;
                return (
                  <div key={p.id} className="bg-zinc-100 relative" style={{ aspectRatio: "9/16" }}>
                    {thumb && <img src={thumb} className="w-full h-full object-cover" alt="" />}
                    <div className="absolute top-1 right-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                      <Play className="w-3.5 h-3.5" fill="white" />
                    </div>
                    {p.is_trial_reel && (
                      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-semibold px-1 py-[1px] rounded flex items-center gap-0.5">
                        <FlaskConical className="w-2.5 h-2.5" /> Prueba
                      </div>
                    )}
                    {p.close_friends_only && (
                      <div className="absolute top-1 left-1 bg-[#1c8c5b] text-white rounded-full p-[2px] drop-shadow">
                        <Lock className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(tab === "reposts" || tab === "tagged") && (
            <div className="text-center text-[10px] text-zinc-400 py-10">
              {tab === "reposts" ? "Sin republicaciones" : "Sin etiquetas"}
            </div>
          )}
            </div>
          </div>

          {storyHighlight && (
            <div className="absolute inset-0 z-40 bg-black flex flex-col">
              <div className="flex gap-1 px-2 pt-3">
                {(storyHighlight.media_urls?.length ? storyHighlight.media_urls : [storyHighlight.cover_url]).map((_, i) => (
                  <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                    <div className={`h-full bg-white ${i <= storyIndex ? "w-full" : "w-0"}`} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-3 pt-2 text-white">
                <div className="flex items-center gap-2 min-w-0">
                  {avatar && <img src={avatar} className="w-6 h-6 rounded-full object-cover" alt="" />}
                  <span className="text-[11px] font-semibold truncate">{username}</span>
                  <span className="text-[11px] text-white/70 truncate">{storyHighlight.title || ""}</span>
                </div>
                <button onClick={() => setStoryHighlight(null)} className="text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 relative">
                {(() => {
                  const items = storyHighlight.media_urls?.length
                    ? storyHighlight.media_urls
                    : (storyHighlight.cover_url ? [storyHighlight.cover_url] : []);
                  const src = items[storyIndex];
                  return src ? (
                    <img src={src} className="absolute inset-0 w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">
                      Sin contenido
                    </div>
                  );
                })()}
                <button
                  onClick={() => setStoryIndex((i) => Math.max(0, i - 1))}
                  className="absolute left-0 top-0 bottom-0 w-1/3"
                  aria-label="Anterior"
                />
                <button
                  onClick={() => {
                    const items = storyHighlight.media_urls?.length
                      ? storyHighlight.media_urls
                      : (storyHighlight.cover_url ? [storyHighlight.cover_url] : []);
                    if (storyIndex >= items.length - 1) setStoryHighlight(null);
                    else setStoryIndex((i) => i + 1);
                  }}
                  className="absolute right-0 top-0 bottom-0 w-2/3"
                  aria-label="Siguiente"
                />
              </div>
            </div>
          )}

          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-black rounded-full z-30" />
        </div>
      </div>
    </div>
  );
}
