import { useState } from "react";
import {
  CalendarClock,
  FileText,
  Images,
  Film,
  Image as ImageIcon,
  MessagesSquare,
} from "lucide-react";
import { StatusBadge } from "@/components/app";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_TYPE_LABEL,
  POST_FORMAT_LABEL,
  formatDateTime,
  formatShortDate,
  safeHttpsUrl,
  type PortalDecision,
  type PortalDeliverableReview,
  type PortalPostReview,
  type PortalReviewComment,
} from "@/lib/portal/model";
import { DecisionControls } from "./DecisionControls";

interface CardActions {
  readOnly: boolean;
  busy: boolean;
  onDecide: (decision: PortalDecision, note: string) => void;
}

const FORMAT_ICON = { photo: ImageIcon, carousel: Images, reel: Film } as const;
const CAPTION_PREVIEW_CHARS = 180;

export function PostApprovalCard({ post, ...actions }: { post: PortalPostReview } & CardActions) {
  const [expanded, setExpanded] = useState(false);
  const Icon = FORMAT_ICON[post.format] ?? ImageIcon;
  const caption = post.caption?.trim() ?? "";
  const long = caption.length > CAPTION_PREVIEW_CHARS;
  const shown =
    expanded || !long ? caption : `${caption.slice(0, CAPTION_PREVIEW_CHARS).trimEnd()}…`;
  const label = post.scheduledAt
    ? `el post del ${formatShortDate(post.scheduledAt.slice(0, 10))}`
    : "este post";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-app-lg border border-border-subtle bg-bg shadow-app-xs">
      <div
        className={cn(
          "relative w-full bg-surface-2",
          post.imageUrl ? "aspect-square sm:aspect-[4/3]" : "aspect-[16/9] sm:aspect-[4/3]",
        )}
      >
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt="Vista previa del post"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-surface-2 to-primary/5 text-muted-foreground">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-bg/80 shadow-app-xs">
              <Icon aria-hidden className="h-6 w-6" />
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-app-xs backdrop-blur">
          <Icon aria-hidden className="h-3.5 w-3.5" /> {POST_FORMAT_LABEL[post.format] ?? "Post"} de
          Instagram
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarClock aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {post.scheduledAt
            ? `Se publicaría el ${formatDateTime(post.scheduledAt)}`
            : "Sin fecha de publicación aún"}
        </p>
        {caption ? (
          <div className="text-sm leading-relaxed">
            <p className="whitespace-pre-line break-words">{shown}</p>
            {long && (
              <button
                type="button"
                className="mt-1 py-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Ver menos" : "Ver texto completo"}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Este post todavía no tiene texto.</p>
        )}
        <div className="mt-auto pt-1">
          <DecisionControls itemLabel={label} {...actions} />
        </div>
      </div>
    </article>
  );
}

export function DeliverableApprovalCard({
  deliverable,
  ...actions
}: { deliverable: PortalDeliverableReview } & CardActions) {
  const fileHref = safeHttpsUrl(deliverable.fileUrl);
  const isImage = (deliverable.mimeType ?? "").startsWith("image/") && Boolean(fileHref);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-app-lg border border-border-subtle bg-bg shadow-app-xs">
      {isImage && fileHref && (
        <a href={fileHref} target="_blank" rel="noreferrer" className="block bg-surface-2">
          <img
            src={fileHref}
            alt={`Vista previa de ${deliverable.title}`}
            loading="lazy"
            className="max-h-80 w-full object-contain"
          />
        </a>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold">{deliverable.title}</h3>
            <p className="text-xs text-muted-foreground">
              {DELIVERABLE_TYPE_LABEL[deliverable.type] ?? "Entrega"}
              {deliverable.dueDate ? ` · para el ${formatShortDate(deliverable.dueDate)}` : ""}
            </p>
          </div>
          <StatusBadge status="in_review" label="Espera tu OK" />
        </div>
        {deliverable.description && (
          <p className="whitespace-pre-line break-words text-sm text-foreground/90">
            {deliverable.description}
          </p>
        )}
        {fileHref && !isImage && (
          <a
            href={fileHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-app-md border border-border-subtle px-3 py-2 text-sm hover:bg-surface-2"
          >
            <FileText aria-hidden className="h-4 w-4 shrink-0" />
            <span className="truncate">{deliverable.fileName || "Ver archivo"}</span>
          </a>
        )}
        <CommentThread comments={deliverable.comments} />
        <div className="mt-auto pt-1">
          <DecisionControls itemLabel={`“${deliverable.title}”`} {...actions} />
        </div>
      </div>
    </article>
  );
}

const ROLE_LABEL: Readonly<Record<PortalReviewComment["authorRole"], string>> = {
  agency: "Vibranding",
  client: "Tú",
  guest: "Invitado",
};

const KIND_LABEL: Readonly<Record<PortalReviewComment["kind"], string | null>> = {
  comment: null,
  approval: "Aprobó",
  change_request: "Pidió cambios",
};

function CommentThread({ comments }: { comments: PortalReviewComment[] }) {
  if (comments.length === 0) return null;
  return (
    <details className="group rounded-app-md bg-surface-2 px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessagesSquare aria-hidden className="h-3.5 w-3.5" />
        Conversación ({comments.length})<span className="ml-auto group-open:hidden">Ver</span>
        <span className="ml-auto hidden group-open:inline">Ocultar</span>
      </summary>
      <ul className="mt-2 space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {c.authorRole === "guest"
                  ? c.authorName || ROLE_LABEL.guest
                  : ROLE_LABEL[c.authorRole]}
              </span>
              {KIND_LABEL[c.kind] ? ` · ${KIND_LABEL[c.kind]}` : ""} · {formatDateTime(c.createdAt)}
            </p>
            <p className="whitespace-pre-line break-words">{c.body}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
