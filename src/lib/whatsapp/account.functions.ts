import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * WhatsApp/Meta tokens live encrypted in Supabase Vault; the table only keeps a
 * reference. They are readable/writable exclusively from the server, so owners
 * go through these authenticated server functions.
 */
export const getWhatsAppVerifyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data, context }) => {
    // Ownership check under RLS (row visible only for the user's own clients).
    const { data: owned } = await (context.supabase.from("whatsapp_accounts_safe" as any) as any)
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta cuenta");

    const { getWaSecret, setWaSecret } = await import("./tokens.server");
    let token = await getWaSecret(data.accountId, "verify_token");
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "");
      await setWaSecret(data.accountId, "verify_token", token);
    }
    return { verifyToken: token };
  });

/**
 * Stores (or clears) the permanent Cloud API access token in the vault.
 * The plaintext never touches the database or the client bundle.
 */
export const setWhatsAppAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string; token: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { data: owned } = await (context.supabase.from("whatsapp_accounts_safe" as any) as any)
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta cuenta");

    const { setWaSecret } = await import("./tokens.server");
    const value = data.token && data.token.trim().length > 0 ? data.token.trim() : null;
    await setWaSecret(data.accountId, "access_token", value);
    return { stored: value !== null };
  });
