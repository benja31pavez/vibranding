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
        const { ingestAccountDay, INGEST_WINDOW_DAYS } = await import(
          "@/lib/meta/insights.server",
        );

        const date = url.searchParams.get("date") ?? undefined;
        const windowDays = Number(url.searchParams.get("days") ?? INGEST_WINDOW_DAYS);

        const { data: accounts, error } = await (
          supabaseAdmin.from("meta_accounts" as any) as any
        )
          .select("id,client_id,ad_account_id,ig_account_id,timezone_name")
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
          results.push(await ingestAccountDay(account, token, date, windowDays));
        }

        const failed = results.filter((r: any) => r.error).length;
        const succeeded = results.length - failed;
        const rowsWritten = results.reduce(
          (acc: number, r: any) => acc + Number(r.adRows ?? 0) + Number(r.postRows ?? 0),
          0,
        );

        // A run that wrote nothing must never look like a success to the cron logger.
        const status = failed === 0 ? 200 : succeeded > 0 ? 207 : 500;

        return Response.json(
          {
            date: date ?? null,
            windowDays,
            accounts: results.length,
            succeeded,
            failed,
            rowsWritten,
            adRows: results.reduce((a: number, r: any) => a + Number(r.adRows ?? 0), 0),
            postRows: results.reduce((a: number, r: any) => a + Number(r.postRows ?? 0), 0),
            results,
          },
          { status },
        );
      },
    },
  },
});
