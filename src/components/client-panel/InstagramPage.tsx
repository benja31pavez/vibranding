import { useMemo, useState, type ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Instagram } from "lucide-react";
import { IphonePreview } from "@/components/IphonePreview";
import {
  CompactStats,
  ErrorState,
  FitList,
  FitPage,
  ListSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  type CompactStat,
  type StatusTone,
} from "@/components/app";
import { POST_FORMAT_LABEL } from "@/lib/portal/model";
import { cn } from "@/lib/utils";
import type {
  IgEngagementView,
  IgHighlightView,
  IgPostView,
  IgProfileRow,
  IgSide,
  InstagramOverview,
} from "@/lib/client-panel/channelsModel";
import { formatDay, formatInstant } from "./format";
import { previewSearch, usePanelMode } from "./panelMode";
import { OneLineState } from "./OneLineState";
import { PanelSectionState } from "./PanelSectionState";
import { sectionHref } from "./sections";
import { usePanelInstagram } from "./useChannelData";

type PreviewProps = ComponentProps<typeof IphonePreview>;

const VIEWS: readonly { key: IgSide; label: string }[] = [
  { key: "current", label: "Actual" },
  { key: "proposed", label: "Propuesta" },
];

const APPROVAL_META: Record<string, { label: string; tone: StatusTone }> = {
  aprobado: { label: "Aprobado", tone: "success" },
  cambios: { label: "Cambios", tone: "warning" },
  rechazado: { label: "Rechazado", tone: "danger" },
};
const PENDING_APPROVAL = { label: "Por aprobar", tone: "info" as StatusTone };

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const rateFmt = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ───────── Adaptadores a las props de IphonePreview (solo presentación) ───────── */

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const count = (v: unknown): number | null => (typeof v === "number" ? v : null);
const flag = (v: unknown): boolean => v === true;
const accountType = (v: unknown): "business" | "personal" =>
  v === "business" ? "business" : "personal";

function toPreviewProfile(row: IgProfileRow, selfId: string): PreviewProps["profile"] {
  const side = (s: IgSide) => ({
    username: text(row[`${s}_username`]),
    display_name: text(row[`${s}_display_name`]),
    followers: count(row[`${s}_followers`]),
    following: count(row[`${s}_following`]),
    posts_count: count(row[`${s}_posts_count`]),
    avatar_url: text(row[`${s}_avatar_url`]),
    bio: text(row[`${s}_bio`]),
    link: text(row[`${s}_link`]),
    account_type: accountType(row[`${s}_account_type`]),
    category: text(row[`${s}_category`]),
    verified: flag(row[`${s}_verified`]),
    threads_enabled: flag(row[`${s}_threads_enabled`]),
    threads_handle: text(row[`${s}_threads_handle`]),
    song_enabled: flag(row[`${s}_song_enabled`]),
    song: text(row[`${s}_song`]),
    show_contact_button: flag(row[`${s}_show_contact_button`]),
    contact_phone: text(row[`${s}_contact_phone`]),
    contact_email: text(row[`${s}_contact_email`]),
  });
  const c = side("current");
  const p = side("proposed");
  return {
    id: selfId,
    client_id: selfId,
    current_username: c.username,
    current_display_name: c.display_name,
    current_followers: c.followers,
    current_following: c.following,
    current_posts_count: c.posts_count,
    current_avatar_url: c.avatar_url,
    current_bio: c.bio,
    current_link: c.link,
    current_account_type: c.account_type,
    current_category: c.category,
    current_verified: c.verified,
    current_threads_enabled: c.threads_enabled,
    current_threads_handle: c.threads_handle,
    current_song_enabled: c.song_enabled,
    current_song: c.song,
    current_show_contact_button: c.show_contact_button,
    current_contact_phone: c.contact_phone,
    current_contact_email: c.contact_email,
    current_synced_at: text(row.current_synced_at),
    proposed_username: p.username,
    proposed_display_name: p.display_name,
    proposed_followers: p.followers,
    proposed_following: p.following,
    proposed_posts_count: p.posts_count,
    proposed_avatar_url: p.avatar_url,
    proposed_bio: p.bio,
    proposed_link: p.link,
    proposed_account_type: p.account_type,
    proposed_category: p.category,
    proposed_verified: p.verified,
    proposed_threads_enabled: p.threads_enabled,
    proposed_threads_handle: p.threads_handle,
    proposed_song_enabled: p.song_enabled,
    proposed_song: p.song,
    proposed_show_contact_button: p.show_contact_button,
    proposed_contact_phone: p.contact_phone,
    proposed_contact_email: p.contact_email,
  };
}

function toPreviewPost(post: IgPostView, selfId: string): PreviewProps["posts"][number] {
  return {
    id: post.id,
    client_id: selfId,
    type: post.type,
    position: post.position,
    image_url: post.imageUrl,
    caption: post.caption,
    scheduled_at: post.scheduledAt,
    format: post.format,
    carousel_urls: post.carouselUrls,
    cover_url: post.coverUrl,
    is_trial_reel: post.isTrialReel,
    close_friends_only: post.closeFriendsOnly,
    objective: null,
    music: post.music,
    location: post.location,
    likes_count: post.likes,
    ig_media_id: null,
    published_at: post.publishedAt,
    version_id: null,
  };
}

function toPreviewHighlight(
  h: IgHighlightView,
  selfId: string,
): PreviewProps["highlights"][number] {
  return {
    id: h.id,
    client_id: selfId,
    type: h.type,
    position: h.position,
    title: h.title,
    cover_url: h.coverUrl,
    media_urls: h.mediaUrls,
  };
}

/* ───────── Página ───────── */

/** Instagram del cliente en solo lectura: grilla Actual/Propuesta, próximas publicaciones y engagement. */
export function InstagramPage() {
  const [view, setView] = useState<IgSide>("proposed");
  const query = usePanelInstagram();
  const hasProfile = query.data?.status === "ok" && Boolean(query.data.data.profile);

  const toggle = hasProfile && (
    <div
      role="group"
      aria-label="Vista de la grilla"
      className="flex gap-1 rounded-full bg-surface-2 p-1"
    >
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          aria-pressed={view === v.key}
          onClick={() => setView(v.key)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            view === v.key ? "bg-surface shadow-app-xs" : "text-muted-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  return (
    <FitPage
      header={<PageHeader size="compact" title="Instagram" actions={toggle || undefined} />}
      contentClassName="md:flex md:flex-col"
    >
      <PanelSectionState query={query} title="No pudimos cargar tu Instagram">
        {(overview) => <InstagramBody overview={overview} view={view} />}
      </PanelSectionState>
    </FitPage>
  );
}

function InstagramBody({ overview, view }: { overview: InstagramOverview; view: IgSide }) {
  const { preview } = usePanelMode();
  const phone = useMemo(() => {
    if (!overview.profile) return null;
    const id = overview.brandId;
    return {
      profile: toPreviewProfile(overview.profile, id),
      posts: overview.posts.map((p) => toPreviewPost(p, id)),
      highlights: overview.highlights.map((h) => toPreviewHighlight(h, id)),
    };
  }, [overview]);

  if (!phone) {
    return (
      <OneLineState icon={Instagram} text="Tu equipo VIBRANDING está preparando tu Instagram." />
    );
  }

  const upcoming = upcomingPosts(overview.posts);
  return (
    <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
      <div className="md:min-h-0 md:overflow-y-auto">
        <IphonePreview
          profile={phone.profile}
          posts={phone.posts}
          highlights={phone.highlights}
          comments={[]}
          view={view}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:min-h-0">
        {overview.engagement && <EngagementStrip engagement={overview.engagement} />}
        <Panel
          fill
          icon={CalendarClock}
          title="Próximas publicaciones"
          actions={
            <Link
              to={sectionHref("calendario")}
              search={previewSearch(preview)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-1 hover:underline"
            >
              Calendario <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">Sin publicaciones programadas.</p>
          ) : (
            <FitList
              items={upcoming}
              getKey={(p) => p.id}
              label="Próximas publicaciones"
              divided
              className="md:min-h-0 md:flex-1"
              renderItem={(p) => <UpcomingRow post={p} />}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Propuesta con fecha desde hoy, de la más próxima a la más lejana. */
function upcomingPosts(posts: readonly IgPostView[], now: Date = new Date()): IgPostView[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return posts
    .filter((p) => p.type === "proposed" && p.scheduledAt && new Date(p.scheduledAt) >= today)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
}

function UpcomingRow({ post }: { post: IgPostView }) {
  const img = post.coverUrl ?? post.imageUrl ?? post.carouselUrls[0] ?? null;
  const approval = (post.approvalStatus && APPROVAL_META[post.approvalStatus]) || PENDING_APPROVAL;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-app-md bg-surface-2">
        {img && <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {post.caption?.trim() || POST_FORMAT_LABEL[post.format]}
        </p>
        <p className="text-xs text-muted-foreground">
          {POST_FORMAT_LABEL[post.format]} ·{" "}
          {post.scheduledAt ? formatInstant(post.scheduledAt) : ""}
        </p>
      </div>
      <StatusBadge status={`ig_${approval.label}`} label={approval.label} tone={approval.tone} />
    </div>
  );
}

function EngagementStrip({ engagement: e }: { engagement: IgEngagementView }) {
  const items: CompactStat[] = [
    {
      key: "rate",
      label: "Engagement",
      value: `${rateFmt.format(e.rate)} %`,
      hint: `Medido el ${formatDay(e.measuredAt)}`,
    },
    {
      key: "followers",
      label: "Seguidores",
      value: e.followers === null ? "—" : nf.format(e.followers),
    },
    {
      key: "likes",
      label: "Likes promedio",
      value: e.avgLikes === null ? "—" : nf.format(e.avgLikes),
    },
    {
      key: "comments",
      label: "Comentarios promedio",
      value: e.avgComments === null ? "—" : nf.format(e.avgComments),
    },
    {
      key: "ppw",
      label: "Posts por semana",
      value: e.postsPerWeek === null ? "—" : nf.format(e.postsPerWeek),
    },
  ];
  return <CompactStats items={items} label="Engagement de Instagram" />;
}
