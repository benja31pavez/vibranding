import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IgWebhookStatus = {
  /** Public callback URL to register in the Meta app. */
  callbackUrl: string | null;
  verifyTokenConfigured: boolean;
  publicOriginConfigured: boolean;
  publicOriginReachable: boolean | null;
  /** Per-client subscription state read from Meta. */
  clients: {
    clientId: string;
    clientName: string;
    igAccountId: string | null;
    subscribedFields: string[];
    subscribed: boolean;
    error: string | null;
    activeTriggers: number;
  }[];
  lastCommentEventAt: string | null;
  eventsLast24h: number;
  failedLast24h: number;
};

/** Status of the Instagram webhook plumbing, for /admin/health. */
export const getIgWebhookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IgWebhookStatus> => {
    const origin = process.env.PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? null;
    const verifyTokenConfigured = Boolean(process.env.IG_WEBHOOK_VERIFY_TOKEN?.trim());

    let reachable: boolean | null = null;
    if (origin) {
      try {
        const res = await fetch(`${origin}/api/public/instagram/webhook?hub.mode=ping`, {
          method: "GET",
        });
        // Published and reachable: our handler answers 403 to a bad handshake.
        reachable = res.status === 403 || res.status === 200;
      } catch {
        reachable = false;
      }
    }

    // Clients the caller can see (RLS-scoped).
    const { data: clientRows } = await context.supabase
      .from("clients")
      .select("id,name")
      .order("name");
    const clients = (clientRows ?? []) as { id: string; name: string }[];

    const { data: accounts } = await context.supabase
      .from("meta_accounts")
      .select("client_id,ig_account_id");
    const igByClient = new Map<string, string | null>();
    for (const a of (accounts ?? []) as any[]) igByClient.set(a.client_id, a.ig_account_id);

    const { data: triggerRows } = await context.supabase
      .from("ig_comment_triggers")
      .select("client_id,is_active");
    const triggerCount = new Map<string, number>();
    for (const t of (triggerRows ?? []) as any[]) {
      if (!t.is_active) continue;
      triggerCount.set(t.client_id, (triggerCount.get(t.client_id) ?? 0) + 1);
    }

    const { getMetaToken } = await import("@/lib/meta/tokens.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { graphUrl } = await import("@/lib/meta/version");

    const out: IgWebhookStatus["clients"] = [];
    for (const c of clients) {
      const igAccountId = igByClient.get(c.id) ?? null;
      const base = {
        clientId: c.id,
        clientName: c.name,
        igAccountId,
        activeTriggers: triggerCount.get(c.id) ?? 0,
      };
      if (!igAccountId) {
        out.push({ ...base, subscribedFields: [], subscribed: false, error: null });
        continue;
      }
      const { data: acc } = await (supabaseAdmin.from("meta_accounts" as any) as any)
        .select("id")
        .eq("client_id", c.id)
        .maybeSingle();
      const token = acc?.id ? await getMetaToken(acc.id) : null;
      if (!token) {
        out.push({
          ...base,
          subscribedFields: [],
          subscribed: false,
          error: "Sin token de Meta almacenado",
        });
        continue;
      }
      try {
        const res = await fetch(
          `${graphUrl(`${igAccountId}/subscribed_apps`)}?access_token=${encodeURIComponent(token)}`,
        );
        const json: any = await res.json().catch(() => null);
        if (!res.ok) {
          out.push({
            ...base,
            subscribedFields: [],
            subscribed: false,
            error: String(json?.error?.message ?? `HTTP ${res.status}`).slice(0, 300),
          });
          continue;
        }
        const fields: string[] = (json?.data ?? []).flatMap(
          (d: any) => d.subscribed_fields ?? [],
        );
        out.push({
          ...base,
          subscribedFields: fields,
          subscribed: fields.includes("comments"),
          error: null,
        });
      } catch (err: any) {
        out.push({
          ...base,
          subscribedFields: [],
          subscribed: false,
          error: String(err?.message ?? "error").slice(0, 300),
        });
      }
    }

    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: recent } = await context.supabase
      .from("ig_automation_events")
      .select("created_at,dm_status")
      .gte("created_at", since);
    const { data: last } = await context.supabase
      .from("ig_automation_events")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    return {
      callbackUrl: origin ? `${origin}/api/public/instagram/webhook` : null,
      verifyTokenConfigured,
      publicOriginConfigured: Boolean(origin),
      publicOriginReachable: reachable,
      clients: out,
      lastCommentEventAt: (last?.[0]?.created_at as string) ?? null,
      eventsLast24h: (recent ?? []).length,
      failedLast24h: (recent ?? []).filter((r: any) => r.dm_status === "failed").length,
    };
  });

/** Subscribes the connected IG account to the comments + messages fields. */
export const subscribeIgWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    // Portal users can see their client row via RLS, so a plain select is not
    // enough: only agency editors may use the org's Meta token here.
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);

    const { getClientMetaToken } = await import("@/lib/meta/clientToken.server");
    const resolved = await getClientMetaToken(data.clientId);
    if (!resolved) {
      return { ok: false as const, reason: "Este cliente no tiene una cuenta de Meta conectada." };
    }
    if (!resolved.account.ig_account_id) {
      return { ok: false as const, reason: "Este cliente no tiene Instagram vinculado en Meta." };
    }

    const { graphUrl } = await import("@/lib/meta/version");
    const res = await fetch(graphUrl(`${resolved.account.ig_account_id}/subscribed_apps`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscribed_fields: "comments,messages",
        access_token: resolved.token,
      }),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false as const,
        reason: String(json?.error?.message ?? `HTTP ${res.status}`).slice(0, 300),
      };
    }
    return { ok: true as const };
  });
