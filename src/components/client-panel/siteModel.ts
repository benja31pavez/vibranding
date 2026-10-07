/**
 * Sitio del cliente (lógica pura): valida la respuesta del RPC
 * client_site_summary y arma los links públicos. Sin red ni React, para
 * probarlo en scripts/check-panel-sitio-ads.mjs.
 */
import { landingCanonicalUrl } from "@/lib/site/landingSeo";
import { SITE_URL } from "@/lib/site";
import { multilinkPath } from "@/lib/multilink";

/** Período fijo de las métricas del sitio (días, hoy incluido). */
export const SITE_METRICS_DAYS = 30;

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,80}$/i;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

/** Página publicada: lo único que el panel muestra del sitio. */
export interface PublishedSitePage {
  published: true;
  slug: string;
  title: string | null;
  url: string;
}

/** Borrador o sin publicar: sin slug ni contenido. */
export type SitePage = { published: false } | PublishedSitePage;

export interface SiteMetrics {
  views: number;
  clicks: number;
  /** Multienlace: clics a WhatsApp. Landing: formularios de contacto enviados. */
  extra: number;
}

export interface ClientSiteSummary {
  days: number;
  multilink: SitePage | null;
  landing: SitePage | null;
  multilinkMetrics: SiteMetrics;
  landingMetrics: SiteMetrics;
}

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
}

function count(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function page(raw: unknown, kind: "multilink" | "landing"): SitePage | null {
  const o = asObj(raw);
  if (!o) return null;
  if (o.published !== true) return { published: false };
  const slug = text(o.slug);
  if (!slug || !SLUG_RE.test(slug)) return { published: false };
  const domain = kind === "multilink" ? text(o.custom_domain) : null;
  const url =
    kind === "landing"
      ? landingCanonicalUrl(slug)
      : domain && DOMAIN_RE.test(domain)
        ? `https://${domain.toLowerCase()}${multilinkPath(slug)}`
        : `${SITE_URL}${multilinkPath(slug)}`;
  return { published: true, slug, title: text(o.title), url };
}

function metrics(raw: unknown, extraKey: string): SiteMetrics {
  const o = asObj(raw) ?? {};
  return { views: count(o.views), clicks: count(o.clicks), extra: count(o[extraKey]) };
}

/** Respuesta del RPC → modelo (null = la sesión no es de un usuario cliente). */
export function parseSiteSummary(raw: unknown): ClientSiteSummary | null {
  const o = asObj(raw);
  if (!o) return null;
  return {
    days: count(o.days) || SITE_METRICS_DAYS,
    multilink: page(o.multilink, "multilink"),
    landing: page(o.landing, "landing"),
    multilinkMetrics: metrics(o.multilink_metrics, "whatsapp_clicks"),
    landingMetrics: metrics(o.landing_metrics, "contacts"),
  };
}

/** "https://vibranding.pro/l/x" → "vibranding.pro/l/x" para mostrar. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Nombre de archivo seguro para el QR. */
export function qrFileBase(slug: string, kind: "multilink" | "landing"): string {
  const base = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "sitio"}-${kind === "multilink" ? "multienlace" : "landing"}`;
}
