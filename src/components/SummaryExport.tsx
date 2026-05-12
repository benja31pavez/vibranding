import type { IGProfile, IGPost, IGHighlight } from "./InstagramEditor";

const fmt = (n: number | null | undefined) => {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return d.toLocaleString("es", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

// Colors hardcoded (hex) so html2canvas can rasterize. No oklch.
const C = {
  bg: "#ffffff",
  ink: "#0a0a0a",
  muted: "#6b7280",
  line: "#e5e7eb",
  surface: "#fafafa",
  accent: "#7c3aed",
  igBlue: "#0095f6",
};

function PhoneCard({
  title, profile, posts, highlights, view,
}: {
  title: string;
  profile: IGProfile;
  posts: IGPost[];
  highlights: IGHighlight[];
  view: "current" | "proposed";
}) {
  const username =
    view === "proposed"
      ? profile.proposed_username || profile.current_username || "usuario"
      : profile.current_username || "usuario";
  const avatar = view === "proposed"
    ? profile.proposed_avatar_url || profile.current_avatar_url
    : profile.current_avatar_url;
  const bio = view === "proposed" ? (profile.proposed_bio ?? profile.current_bio) : profile.current_bio;
  const link = view === "proposed" ? (profile.proposed_link ?? profile.current_link) : profile.current_link;
  const followers = view === "proposed" ? (profile.proposed_followers ?? profile.current_followers) : profile.current_followers;
  const following = view === "proposed" ? (profile.proposed_following ?? profile.current_following) : profile.current_following;
  const postsCount = view === "proposed" ? (profile.proposed_posts_count ?? profile.current_posts_count) : profile.current_posts_count;
  const accountType = view === "proposed" ? profile.proposed_account_type : profile.current_account_type;
  const category = view === "proposed" ? profile.proposed_category : profile.current_category;
  const verified = view === "proposed" ? profile.proposed_verified : profile.current_verified;
  const threadsEnabled = view === "proposed" ? profile.proposed_threads_enabled : profile.current_threads_enabled;
  const threadsHandle = view === "proposed" ? (profile.proposed_threads_handle ?? profile.current_threads_handle) : profile.current_threads_handle;
  const songEnabled = view === "proposed" ? profile.proposed_song_enabled : profile.current_song_enabled;
  const song = view === "proposed" ? (profile.proposed_song ?? profile.current_song) : profile.current_song;

  const grid = posts
    .filter((p) => p.type === view)
    .sort((a, b) => a.position - b.position)
    .slice(0, 6);

  return (
    <div style={{ width: 320 }}>
      <div style={{
        textAlign: "center", fontSize: 11, color: C.muted, letterSpacing: 1,
        textTransform: "uppercase", fontWeight: 600, marginBottom: 10,
      }}>
        {title}
      </div>
      <div style={{ background: "#000", borderRadius: 36, padding: 8 }}>
        <div style={{
          background: "#fff", borderRadius: 30, overflow: "hidden", position: "relative",
        }}>
          <div style={{ padding: "18px 14px 8px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#000", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
              <span>{username}</span>
              {verified && (
                <span style={{ background: C.igBlue, color: "#fff", borderRadius: "50%", width: 13, height: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900 }}>✓</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%", overflow: "hidden",
                background: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)",
                padding: 2,
              }}>
                <div style={{ background: "#fff", borderRadius: "50%", padding: 2, width: "100%", height: "100%" }}>
                  {avatar ? (
                    <img src={avatar} crossOrigin="anonymous"
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#e5e7eb" }} />
                  )}
                </div>
              </div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center", color: "#000" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(postsCount)}</div>
                  <div style={{ fontSize: 10, color: "#52525b" }}>posts</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(followers)}</div>
                  <div style={{ fontSize: 10, color: "#52525b" }}>seguidores</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(following)}</div>
                  <div style={{ fontSize: 10, color: "#52525b" }}>seguidos</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, color: "#000", fontSize: 12, lineHeight: 1.4 }}>
              {bio && <div style={{ whiteSpace: "pre-line" }}>{bio}</div>}
              {accountType === "business" && category && (
                <div style={{ color: "#52525b", fontSize: 11 }}>{category}</div>
              )}
              {link && <div style={{ color: "#00376b", fontWeight: 600, marginTop: 2 }}>{link.replace(/^https?:\/\//, "")}</div>}
              {threadsEnabled && threadsHandle && (
                <div style={{ color: "#3f3f46", fontSize: 11, marginTop: 2 }}>@{threadsHandle.replace(/^@/, "")} · Threads</div>
              )}
              {songEnabled && song && (
                <div style={{ color: "#3f3f46", fontSize: 11, marginTop: 2 }}>♪ {song}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <div style={{ flex: 1, background: C.igBlue, color: "#fff", textAlign: "center", fontSize: 11, fontWeight: 700, padding: "6px 0", borderRadius: 6 }}>Seguir</div>
              <div style={{ flex: 1, background: "#f4f4f5", color: "#000", textAlign: "center", fontSize: 11, fontWeight: 700, padding: "6px 0", borderRadius: 6 }}>Mensaje</div>
            </div>
          </div>
          {(() => {
            const myH = highlights.filter((h) => h.type === view).sort((a, b) => a.position - b.position);
            if (!myH.length) return null;
            return (
              <div style={{ display: "flex", gap: 10, padding: "10px 14px 4px", overflow: "hidden" }}>
                {myH.slice(0, 5).map((h) => (
                  <div key={h.id} style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", border: `1px solid ${C.line}`, padding: 2, background: "#fff" }}>
                      {h.cover_url ? (
                        <img src={h.cover_url} crossOrigin="anonymous"
                          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#f4f4f5" }} />
                      )}
                    </div>
                    <div style={{ fontSize: 8, color: "#000", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.title || "Destacada"}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, background: "#fff", marginTop: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => {
              const p = grid.find((x) => x.position === i);
              const badge = p?.format === "reel" ? "▶" : p?.format === "carousel" ? "▦" : null;
              const thumb = p?.format === "reel" ? (p.cover_url || p.image_url) : p?.image_url;
              return (
                <div key={i} style={{ aspectRatio: "1 / 1", background: "#f4f4f5", position: "relative" }}>
                  {thumb && (
                    <img src={thumb} crossOrigin="anonymous"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  {p?.close_friends_only && (
                    <div style={{ position: "absolute", top: 4, left: 4, background: "#1c8c5b", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 4 }}>★</div>
                  )}
                  {p?.format === "reel" && p?.is_trial_reel && (
                    <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3 }}>PRUEBA</div>
                  )}
                  {badge && (
                    <div style={{ position: "absolute", top: 4, right: 4, color: "#fff", fontSize: 11, fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                      {badge}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PostsTable({ title, posts, type }: { title: string; posts: IGPost[]; type: "current" | "proposed" }) {
  const fmtLabel = (f: string) => f === "reel" ? "Reel" : f === "carousel" ? "Carrusel" : "Foto";
  const items = posts
    .filter((p) => p.type === type)
    .sort((a, b) => a.position - b.position)
    .slice(0, 6);
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: type === "proposed" ? C.accent : C.ink, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map((p, i) => {
          const mainThumb = p.format === "reel" ? (p.cover_url || p.image_url) : p.image_url;
          return (
            <div key={p.id} style={{
              border: `1px solid ${C.line}`, borderRadius: 12, padding: 10,
              background: C.surface, display: "flex", gap: 10,
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: "#e5e7eb", overflow: "hidden", flexShrink: 0 }}>
                {mainThumb && (
                  <img src={mainThumb} crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>
                  POST #{i + 1} · {fmtLabel(p.format)}
                  {p.format === "carousel" && p.carousel_urls?.length ? ` · ${p.carousel_urls.length} img` : ""}
                  {p.format === "reel" && p.is_trial_reel ? " · PRUEBA" : ""}
                  {p.close_friends_only ? " · MEJORES AMIGOS" : ""}
                </div>
                <div style={{ fontSize: 11, color: C.ink, marginTop: 2, lineHeight: 1.3, wordBreak: "break-word" }}>
                  {p.caption || <span style={{ color: C.muted }}>Sin caption</span>}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>📅 {fmtDate(p.scheduled_at)}</div>
                {p.format === "carousel" && p.carousel_urls?.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {p.carousel_urls.slice(0, 8).map((u, k) => (
                      <div key={k} style={{ width: 28, height: 28, borderRadius: 4, overflow: "hidden", background: "#e5e7eb" }}>
                        <img src={u} crossOrigin="anonymous"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SummaryExport({
  client, profile, posts, highlights,
}: {
  client: { name: string; instagram_handle: string | null };
  profile: IGProfile;
  posts: IGPost[];
  highlights: IGHighlight[];
}) {
  return (
    <div style={{
      background: C.bg, color: C.ink, padding: 32, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      width: 900,
    }}>
      <div style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
          Resumen de asesoría
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{client.name}</div>
        {client.instagram_handle && (
          <div style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>@{client.instagram_handle}</div>
        )}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Generado el {new Date().toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start" }}>
        <PhoneCard title="Actual" profile={profile} posts={posts} highlights={highlights} view="current" />
        <PhoneCard title="Propuesta" profile={profile} posts={posts} highlights={highlights} view="proposed" />
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Datos del perfil</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DataCol title="Actual" data={{
            Usuario: profile.current_username,
            Seguidores: fmt(profile.current_followers),
            Seguidos: fmt(profile.current_following),
            Posts: fmt(profile.current_posts_count),
            Enlace: profile.current_link,
            Descripción: profile.current_bio,
          }} accent={false} />
          <DataCol title="Propuesta" data={{
            Usuario: profile.proposed_username,
            Seguidores: fmt(profile.proposed_followers),
            Seguidos: fmt(profile.proposed_following),
            Posts: fmt(profile.proposed_posts_count),
            Enlace: profile.proposed_link,
            Descripción: profile.proposed_bio,
          }} accent />
        </div>
      </div>

      <PostsTable title="Posts actuales" posts={posts} type="current" />
      <PostsTable title="Posts propuestos" posts={posts} type="proposed" />
    </div>
  );
}

function DataCol({ title, data, accent }: { title: string; data: Record<string, any>; accent: boolean }) {
  return (
    <div style={{
      border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, background: C.surface,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
        color: accent ? C.accent : C.muted, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", rowGap: 6 }}>
        {Object.entries(data).map(([k, v]) => (
          <div key={k} style={{ fontSize: 12, display: "grid", gridTemplateColumns: "100px 1fr", gap: 8 }}>
            <div style={{ color: C.muted }}>{k}</div>
            <div style={{ color: C.ink, wordBreak: "break-word", whiteSpace: "pre-line" }}>
              {v || <span style={{ color: C.muted }}>—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
