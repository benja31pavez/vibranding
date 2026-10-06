import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardCheck, ImageIcon, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  monthTitle,
  type PortalApprovals,
  type SectionResult,
} from "@/lib/portal/model";
import type { MonthPost, MonthSummary } from "./clientView";

/** Miniaturas que caben en el bloque "Publicado". */
const THUMBS = 4;

export const CLIENT_CARD_CLS =
  "min-w-0 rounded-app-lg border border-border-subtle bg-surface px-4 py-3.5 shadow-app-xs md:px-5";

function Thumb({ post, className }: { post: MonthPost; className?: string }) {
  const src = post.cover_url ?? post.image_url;
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-app-sm bg-surface-2 ${className ?? "h-11 w-11"}`}
      title={post.caption?.trim() || undefined}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon aria-hidden className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

function Block({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-app-md bg-surface-2/60 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      <div className="min-h-11">{children}</div>
    </div>
  );
}

interface MonthSummaryCardProps {
  clientId: string;
  month: string;
  summary: MonthSummary;
  approvals: SectionResult<PortalApprovals> | undefined;
  loading: boolean;
}

/** "Resumen del mes": lo publicado, lo que espera aprobación y el próximo post. */
export function MonthSummaryCard({
  clientId,
  month,
  summary,
  approvals,
  loading,
}: MonthSummaryCardProps) {
  const pendingDeliverables = approvals?.ok ? approvals.data.deliverables.length : 0;
  const pendingPosts = approvals?.ok ? approvals.data.posts.length : 0;
  const pending = pendingDeliverables + pendingPosts;
  const { published, next } = summary;

  return (
    <section
      aria-label="Resumen del mes"
      className={`${CLIENT_CARD_CLS} flex h-full flex-col gap-3`}
    >
      <div className="min-w-0">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--brand-1)" }}
        >
          Resumen del mes
        </p>
        <h2 className="text-base font-semibold">{monthTitle(`${month}-01`)}</h2>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Block icon={Send} label="Publicado" value={published.length}>
          {published.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {published.slice(0, THUMBS).map((p) => (
                <Thumb key={p.id} post={p} />
              ))}
              {published.length > THUMBS && (
                <span className="text-xs text-muted-foreground">+{published.length - THUMBS}</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aún nada este mes</p>
          )}
        </Block>

        <Block
          icon={ClipboardCheck}
          label="Por aprobar"
          value={loading ? <Skeleton className="h-6 w-8" /> : pending}
        >
          {pending > 0 ? (
            <Button asChild size="sm" className="h-8">
              <Link
                to={
                  pendingDeliverables > 0
                    ? "/clients/$clientId/deliverables"
                    : "/clients/$clientId/instagram"
                }
                params={{ clientId }}
              >
                Revisar
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {loading ? "" : approvals?.ok === false ? "No pudimos cargarlo" : "Nada pendiente"}
            </p>
          )}
        </Block>

        <Block
          icon={CalendarClock}
          label="Próximo post"
          value={
            next?.scheduled_at ? (
              <span className="text-base font-semibold">{formatDateTime(next.scheduled_at)}</span>
            ) : (
              "—"
            )
          }
        >
          {next ? (
            <div className="flex min-w-0 items-center gap-2">
              <Thumb post={next} />
              <p className="line-clamp-2 min-w-0 text-xs text-muted-foreground">
                {next.caption?.trim() || "Publicación sin texto"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nada programado</p>
          )}
        </Block>
      </div>
    </section>
  );
}
