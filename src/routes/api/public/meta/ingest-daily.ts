import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";

/**
 * Daily insights pull for every connected Meta account.
 * Called by the scheduled job; protected by the shared dispatch secret so it
 * cannot be triggered (and rate-limited against Meta) by anyone on the internet.
 */
export const Route = createFileRoute("/api/public/meta/ingest-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[meta ingest] DISPATCH_SECRET missing — rejecting request");
          return new Response("Server misconfigured", { status: 500 });
        }
        const provided = request.headers.get("x-dispatch-secret") ?? "";
        const [a, b] = await Promise.all([
          hmacSha256Hex(expected, provided),
          hmacSha256Hex(expected, expected),
        ]);
        if (!provided || !timingSafeEqualHex(a, b)) {
          return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getMetaToken } = await import("@/lib/meta/tokens.server");
        const { ingestAccountDay, yesterdayISO } = await import("@/lib/meta/insights.server");

        const date = url.searchParams.get("date") ?? yesterdayISO();

        const { data: accounts, error } = await (
          supabaseAdmin.from("meta_accounts" as any) as any
        )
          .select("id,client_id,ad_account_id,ig_account_id")
          .eq("connected", true);
        if (error) {
          console.error("[meta ingest] cannot list accounts", error.message);
          return new Response("Error", { status: 500 });
        }

        const results = [];
        for (const account of accounts ?? []) {
          const token = await getMetaToken(account.id);
          if (!token) {
            results.push({ accountId: account.id, error: "sin token en el vault" });
            continue;
          }
          results.push(await ingestAccountDay(account, token, date));
        }

        const failed = results.filter((r: any) => r.error).length;
        return Response.json({ date, accounts: results.length, failed, results });
      },
    },
  },
});
