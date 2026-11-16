/** Cálculos puros de la analítica del multienlace (sin red ni React). */
import type { MultilinkItem } from "@/lib/multilink";

export type EventRow = {
  user_agent?: string | null;
  event_name: string;
  item_id: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
};

export type DayPoint = { date: string; visitas: number; clics: number; whatsapp: number };

const DAY_MS = 86_400_000;

export function isClick(r: EventRow): boolean {
  return r.event_name === "link_click" || r.event_name === "whatsapp_click";
}

export function sourceLabel(r: EventRow): string {
  if (r.utm_source) {
    return [r.utm_source, r.utm_medium].filter(Boolean).join(" / ");
  }
  const ref = (r.referrer ?? "").trim();
  if (!ref) return "Directo / app";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (/instagram/.test(host)) return "Instagram";
    if (/facebook|fb\./.test(host)) return "Facebook";
    if (/whatsapp|wa\.me/.test(host)) return "WhatsApp";
    if (/t\.co|twitter|x\.com/.test(host)) return "X / Twitter";
    if (/tiktok/.test(host)) return "TikTok";
    if (/google/.test(host)) return "Google";
    return host;
  } catch {
    return "Otro";
  }
}

/** Una fila por día del período (los días sin eventos quedan en cero). */
export function dailySeries(rows: EventRow[], days: number, now = Date.now()): DayPoint[] {
  const buckets = new Map<string, DayPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(k, { date: k, visitas: 0, clics: 0, whatsapp: 0 });
  }
  for (const r of rows) {
    const day = buckets.get(r.created_at.slice(0, 10));
    if (!day) continue;
    if (r.event_name === "page_view") day.visitas++;
    else if (isClick(r)) {
      day.clics++;
      if (r.event_name === "whatsapp_click") day.whatsapp++;
    }
  }
  return Array.from(buckets.values());
}

export type ItemClicks = { item: MultilinkItem; clicks: number };

export function clicksPerItem(rows: EventRow[], items: MultilinkItem[]): ItemClicks[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!isClick(r) || !r.item_id) continue;
    counts.set(r.item_id, (counts.get(r.item_id) ?? 0) + 1);
  }
  return items
    .map((item) => ({ item, clicks: counts.get(item.id) ?? 0 }))
    .sort((a, b) => b.clicks - a.clicks);
}

export function visitSources(rows: EventRow[], limit = 10): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.event_name !== "page_view") continue;
    const k = sourceLabel(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

const NUMBER = new Intl.NumberFormat("es-CL");
export const formatCount = (n: number): string => NUMBER.format(n);
export const formatPct = (n: number | null): string =>
  n === null ? "—" : `${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
