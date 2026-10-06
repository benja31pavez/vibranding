import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Images,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton, StatusBadge } from "@/components/app";
import {
  DELIVERABLE_TYPE_LABEL,
  POST_FORMAT_LABEL,
  currentMonth,
  formatTime,
  groupCalendar,
  monthTitle,
  shiftMonth,
  type CalendarEntry,
} from "@/lib/portal/model";
import { PortalSection } from "./PortalSection";
import { errorMessage, usePortalCalendar, type PortalMode } from "./usePortal";

const FORMAT_ICON = { photo: ImageIcon, carousel: Images, reel: Film } as const;
const CAPTION_CHARS = 90;

const DAY_HEADER = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function dayTitle(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const text = DAY_HEADER.format(new Date(Date.UTC(y, m - 1, d)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const POST_APPROVAL_BADGE: Readonly<Record<string, { status: string; label: string }>> = {
  pendiente: { status: "in_review", label: "Espera tu OK" },
  aprobado: { status: "approved", label: "Aprobado" },
  cambios: { status: "change_request", label: "En cambios" },
  rechazado: { status: "rejected", label: "Descartado" },
};

/** Calendario del mes: publicaciones programadas (sin archivadas) y entregas con fecha. */
export function CalendarSection({ mode, enabled }: { mode: PortalMode; enabled: boolean }) {
  const [month, setMonth] = useState(currentMonth);
  const calendar = usePortalCalendar(mode, month, enabled);

  return (
    <PortalSection
      id="calendario"
      title="Calendario del mes"
      icon={CalendarDays}
      actions={
        <div className="flex w-full items-center justify-between gap-1 rounded-full border border-border-subtle bg-bg p-0.5 sm:w-auto">
          <Button
            className="h-9 w-9 rounded-full"
            size="icon"
            variant="ghost"
            aria-label="Mes anterior"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Button>
          <span
            className="min-w-[8.5rem] text-center text-sm font-semibold tabular-nums"
            aria-live="polite"
          >
            {monthTitle(month)}
          </span>
          <Button
            className="h-9 w-9 rounded-full"
            size="icon"
            variant="ghost"
            aria-label="Mes siguiente"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {calendar.isPending ? (
        <ListSkeleton rows={4} label="Cargando calendario" />
      ) : calendar.isError ? (
        <ErrorState
          message={errorMessage(calendar.error)}
          onRetry={() => void calendar.refetch()}
          retrying={calendar.isFetching}
        />
      ) : !calendar.data ||
        (calendar.data.posts.length === 0 && calendar.data.deliverables.length === 0) ? (
        <EmptyState
          size="compact"
          icon={CalendarDays}
          title={`Nada agendado para ${monthTitle(month).toLowerCase()}`}
          description="Cuando programemos publicaciones o entregas, las verás aquí."
        />
      ) : (
        <ol className="space-y-5">
          {groupCalendar(calendar.data).map((day) => (
            <li key={day.day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dayTitle(day.day)}
              </h3>
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-app-md border border-border-subtle bg-bg">
                {day.entries.map((entry) => (
                  <CalendarRow
                    key={`${entry.kind}:${entry.kind === "post" ? entry.post.id : entry.deliverable.id}`}
                    entry={entry}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </PortalSection>
  );
}

function CalendarRow({ entry }: { entry: CalendarEntry }) {
  if (entry.kind === "post") {
    const { post } = entry;
    const Icon = FORMAT_ICON[post.format] ?? ImageIcon;
    const caption = post.caption?.trim() ?? "";
    const badge = post.approvalStatus ? POST_APPROVAL_BADGE[post.approvalStatus] : undefined;
    return (
      <li className="flex items-start gap-3 px-3 py-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-primary/10 text-primary">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="min-w-0 text-sm font-medium">
              {POST_FORMAT_LABEL[post.format] ?? "Post"} en Instagram
              <span className="font-normal tabular-nums text-muted-foreground">
                {" "}
                · {formatTime(post.scheduledAt)}
              </span>
            </p>
            {badge && <StatusBadge status={badge.status} label={badge.label} />}
          </div>
          {caption && (
            <p className="mt-0.5 line-clamp-1 break-words text-xs text-muted-foreground">
              {caption.length > CAPTION_CHARS ? `${caption.slice(0, CAPTION_CHARS)}…` : caption}
            </p>
          )}
        </div>
      </li>
    );
  }
  const { deliverable } = entry;
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-surface-2 text-muted-foreground">
        <PackageCheck aria-hidden className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-sm font-medium">{deliverable.title}</p>
          <StatusBadge status={deliverable.status} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {DELIVERABLE_TYPE_LABEL[deliverable.type] ?? "Entrega"}
        </p>
      </div>
    </li>
  );
}
