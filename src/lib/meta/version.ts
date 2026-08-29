/**
 * Single source of truth for the Meta Graph / Marketing API version.
 *
 * Override with the META_GRAPH_VERSION env var so future bumps need no code
 * change. Marketing API v23.0 expired 2026-06-09; the default below is the
 * newest live version, and anything below v25.0 must not be used.
 */
export const DEFAULT_META_GRAPH_VERSION = "v26.0";

export function metaGraphVersion(): string {
  const raw = process.env.META_GRAPH_VERSION?.trim();
  if (!raw) return DEFAULT_META_GRAPH_VERSION;
  return /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_META_GRAPH_VERSION;
}

/** Base URL, e.g. https://graph.facebook.com/v26.0 */
export function graphBase(): string {
  return `https://graph.facebook.com/${metaGraphVersion()}`;
}

export function graphUrl(path: string): string {
  return `${graphBase()}/${path}`;
}
