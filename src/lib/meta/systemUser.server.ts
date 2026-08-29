// Server-only helpers for the System User (permanent token) connection path.
// Used while Meta App Review is pending: a System User token from Business
// Manager already carries the needed permissions without a consent dialog.
import { graph } from "@/lib/meta/oauth.server";

export type DiscoveredAdAccount = {
  id: string;
  name: string;
  timezone_name: string | null;
  currency: string | null;
  source: string;
};

export type DiscoveredIgAccount = {
  id: string;
  username: string;
  page_id: string | null;
  page_name: string | null;
  source: string;
};

export type DiscoveredPage = { id: string; name: string };

export type SystemUserAssets = {
  scopes: string[];
  tokenType: string | null;
  expiresAt: string | null;
  appId: string | null;
  adAccounts: DiscoveredAdAccount[];
  igAccounts: DiscoveredIgAccount[];
  pages: DiscoveredPage[];
  warnings: string[];
};

async function safe<T>(p: Promise<T>, label: string, warnings: string[]): Promise<T | null> {
  try {
    return await p;
  } catch (e: any) {
    warnings.push(`${label}: ${e?.message ?? "error"}`);
    return null;
  }
}

/**
 * Inspects a pasted token and lists the ad accounts / Instagram accounts it can
 * reach. Works for both System User tokens (assigned_* edges) and plain user
 * tokens (me/* edges), so the picker is identical for both paths.
 */
export async function discoverSystemUserAssets(token: string): Promise<SystemUserAssets> {
  const warnings: string[] = [];

  const debug = await safe(
    graph<any>("debug_token", { input_token: token, access_token: token }),
    "debug_token",
    warnings,
  );
  const info = debug?.data ?? {};
  if (info?.is_valid === false) {
    throw new Error(info?.error?.message ?? "El token no es válido según Meta");
  }

  const adMap = new Map<string, DiscoveredAdAccount>();
  const igMap = new Map<string, DiscoveredIgAccount>();
  const pageMap = new Map<string, DiscoveredPage>();

  const collectAdAccounts = (rows: any[], source: string) => {
    for (const a of rows ?? []) {
      if (!a?.id) continue;
      if (!adMap.has(a.id)) {
        adMap.set(a.id, {
          id: a.id,
          name: a.name ?? a.id,
          timezone_name: a.timezone_name ?? null,
          currency: a.currency ?? null,
          source,
        });
      }
    }
  };

  const collectPages = (rows: any[], source: string) => {
    for (const p of rows ?? []) {
      if (!p?.id) continue;
      pageMap.set(p.id, { id: p.id, name: p.name ?? p.id });
      const ig = p.instagram_business_account;
      if (ig?.id && !igMap.has(ig.id)) {
        igMap.set(ig.id, {
          id: ig.id,
          username: ig.username ?? "",
          page_id: p.id,
          page_name: p.name ?? null,
          source,
        });
      }
    }
  };

  const adFields = "id,account_id,name,timezone_name,currency";
  const pageFields = "id,name,instagram_business_account{id,username}";

  const [assignedAds, ownAds, assignedPages, ownPages] = await Promise.all([
    safe(
      graph<any>("me/assigned_ad_accounts", { access_token: token, fields: adFields, limit: "200" }),
      "assigned_ad_accounts",
      warnings,
    ),
    safe(
      graph<any>("me/adaccounts", { access_token: token, fields: adFields, limit: "200" }),
      "adaccounts",
      warnings,
    ),
    safe(
      graph<any>("me/assigned_pages", { access_token: token, fields: pageFields, limit: "200" }),
      "assigned_pages",
      warnings,
    ),
    safe(
      graph<any>("me/accounts", { access_token: token, fields: pageFields, limit: "200" }),
      "accounts",
      warnings,
    ),
  ]);

  collectAdAccounts(assignedAds?.data, "asignada al System User");
  collectAdAccounts(ownAds?.data, "cuenta del usuario");
  collectPages(assignedPages?.data, "página asignada");
  collectPages(ownPages?.data, "página del usuario");

  // Business-level fallback: assets owned by (or shared with) the businesses the
  // token can see, which the me/* edges sometimes omit for System Users.
  const businesses = await safe(
    graph<any>("me/businesses", { access_token: token, fields: "id,name", limit: "50" }),
    "businesses",
    warnings,
  );
  for (const b of businesses?.data ?? []) {
    const [oa, ca, op, cp, oig] = await Promise.all([
      safe(graph<any>(`${b.id}/owned_ad_accounts`, { access_token: token, fields: adFields, limit: "200" }), `owned_ad_accounts(${b.name})`, warnings),
      safe(graph<any>(`${b.id}/client_ad_accounts`, { access_token: token, fields: adFields, limit: "200" }), `client_ad_accounts(${b.name})`, warnings),
      safe(graph<any>(`${b.id}/owned_pages`, { access_token: token, fields: pageFields, limit: "200" }), `owned_pages(${b.name})`, warnings),
      safe(graph<any>(`${b.id}/client_pages`, { access_token: token, fields: pageFields, limit: "200" }), `client_pages(${b.name})`, warnings),
      safe(graph<any>(`${b.id}/owned_instagram_accounts`, { access_token: token, fields: "id,username", limit: "200" }), `owned_instagram_accounts(${b.name})`, warnings),
    ]);
    collectAdAccounts(oa?.data, `Business: ${b.name}`);
    collectAdAccounts(ca?.data, `Cliente de: ${b.name}`);
    collectPages(op?.data, `Business: ${b.name}`);
    collectPages(cp?.data, `Cliente de: ${b.name}`);
    for (const ig of oig?.data ?? []) {
      if (ig?.id && !igMap.has(ig.id)) {
        igMap.set(ig.id, {
          id: ig.id,
          username: ig.username ?? "",
          page_id: null,
          page_name: null,
          source: `Business: ${b.name}`,
        });
      }
    }
  }

  const adAccounts = Array.from(adMap.values());
  const igAccounts = Array.from(igMap.values());
  if (adAccounts.length === 0 && igAccounts.length === 0) {
    throw new Error(
      warnings.join(" · ")
        || "El token no da acceso a ninguna cuenta publicitaria ni de Instagram. Revisa los activos asignados al System User.",
    );
  }

  return {
    scopes: Array.isArray(info?.scopes) ? info.scopes : [],
    tokenType: info?.type ?? null,
    expiresAt:
      info?.expires_at && Number(info.expires_at) > 0
        ? new Date(Number(info.expires_at) * 1000).toISOString()
        : null,
    appId: info?.app_id ? String(info.app_id) : null,
    adAccounts,
    igAccounts,
    pages: Array.from(pageMap.values()),
    warnings,
  };
}

/** Normalises an ad account id to Meta's act_ prefixed form. */
export function normalizeAdAccountId(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return v.startsWith("act_") ? v : `act_${v.replace(/^act_/, "")}`;
}
