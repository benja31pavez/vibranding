import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The webhook verify token is not readable from the client (no SELECT grant on
 * that column). Owners fetch it on demand through this authenticated server fn.
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acc } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("verify_token")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!acc) throw new Error("Cuenta no encontrada");
    return { verifyToken: acc.verify_token as string };
  });
