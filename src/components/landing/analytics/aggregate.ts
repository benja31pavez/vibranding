/** Cálculos puros de la analítica de la landing (sin red ni React). */

export type LandingEventRow = {
  user_agent?: string | null;
  event_name: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign?: string | null;
  created_at: string;
};

export type DayPoint = { date: string; visitas: number; clics: number; envios: number };
export type Ranked = { label: string; count: number };

const DAY_MS = 86_400_000;

export function sourceLabel(r: LandingEventRow): string {
  if (r.utm_source) return [r.utm_source, r.utm_medium].filter(Boolean).join(" / ");
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

export function summarize(rows: LandingEventRow[]) {
  const count = (name: string) => rows.filter((r) => r.event_name === name).length;
  const views = count("page_view");
  const ctaClicks = count("contact_click");
  const waClicks = count("whatsapp_click");
  const submits = count("contact_submit");
  /** Contactos = formularios enviados + clics a WhatsApp (ambos son conversación iniciada). */
  const contacts = submits + waClicks;
  const conversion = views > 0 ? (contacts / views) * 100 : null;
  return { views, ctaClicks, waClicks, submits, contacts, conversion };
}

export function dailySeries(rows: LandingEventRow[], days: number, now = Date.now()): DayPoint[] {
  const buckets = new Map<string, DayPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const k = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    buckets.set(k, { date: k, visitas: 0, clics: 0, envios: 0 });
  }
  for (const r of rows) {
    const day = buckets.get(r.created_at.slice(0, 10));
    if (!day) continue;
    if (r.event_name === "page_view") day.visitas++;
    else if (r.event_name === "contact_submit") day.envios++;
    else day.clics++;
  }
  return Array.from(buckets.values());
}

function rank(keys: (string | null)[]): Ranked[] {
  const m = new Map<string, number>();
  for (const k of keys) if (k) m.set(k, (m.get(k) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function trafficSources(rows: LandingEventRow[]): Ranked[] {
  return rank(rows.filter((r) => r.event_name === "page_view").map(sourceLabel));
}

export function campaigns(rows: LandingEventRow[]): Ranked[] {
  return rank(
    rows.map(
      (r) => [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ") || null,
    ),
  );
}

/** "12,5 %" con coma decimal chilena; null → "—". */
export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 1 })} %`;
}

export function formatInt(value: number): string {
  return value.toLocaleString("es-CL");
}
