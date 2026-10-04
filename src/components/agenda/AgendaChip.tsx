import { useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { formatTime } from "@/lib/agenda/dates";
import type { AgendaItem } from "@/lib/agenda/types";
import { cn } from "@/lib/utils";
import { KIND_STYLE, describeItem, itemStyle } from "./agendaStyles";

interface AgendaLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  title?: string;
}

/** Enlace interno con navegación del router (respeta ctrl/cmd + clic para abrir en otra pestaña). */
export function AgendaLink({ href, className, children, ...rest }: AgendaLinkProps) {
  const router = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    router.history.push(href);
  };
  return (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  );
}

interface AgendaChipProps {
  item: AgendaItem;
  /** Con `asLink` el chip navega a la pantalla de origen; si no, es solo visual. */
  asLink?: boolean;
  className?: string;
}

/** Chip compacto: ícono del tipo (no solo color) + hora + título. */
export function AgendaChip({ item, asLink = false, className }: AgendaChipProps) {
  const Icon = KIND_STYLE[item.kind].icon;
  const label = describeItem(item);
  const content = (
    <>
      <Icon aria-hidden className="h-3 w-3 shrink-0" />
      {!item.allDay && (
        <span aria-hidden className="shrink-0 tabular-nums opacity-80">
          {formatTime(item.date)}
        </span>
      )}
      <span aria-hidden className="truncate">
        {item.title}
      </span>
    </>
  );
  const cls = cn(
    "flex min-w-0 items-center gap-1 rounded-app-sm border px-1.5 py-0.5 text-[11px] leading-tight",
    itemStyle(item).chip,
    asLink &&
      "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  if (asLink) {
    return (
      <AgendaLink href={item.href} className={cls} aria-label={label} title={label}>
        {content}
      </AgendaLink>
    );
  }
  return (
    <span className={cls} title={label}>
      <span className="sr-only">{label}</span>
      {content}
    </span>
  );
}
