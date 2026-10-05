// Server-only helpers for the client setup checklist: they answer *why* a run
// wrote zero rows instead of leaving a bare "0 filas" on screen.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { graph } from "@/lib/meta/oauth.server";

export type ZeroCause = { code: string; message: string };

const actId = (id: string) => (id.startsWith("act_") ? id : `act_${id}`);

/**
 * Explains a zero-row ingestion. Never returns a cause when rows were written:
 * a successful run with data is not a failure, and neither is a zero-row run.
 */
export async function diagnoseIngest(opts: {
  clientId: string;
  token: string;
  adAccountId: string | null;
  igAccountId: string | null;
  from: string;
  to: string;
  adRows: number;
  postRows: number;
  error?: string;
}): Promise<ZeroCause[]> {
  const causes: ZeroCause[] = [];

  if (opts.error) {
    causes.push({ code: "meta_error", message: opts.error });
    return causes;
  }

  if (opts.adRows === 0 && opts.adAccountId) {
    let published = 0;
    let metaError: string | null = null;
    try {
      const res = await graph<any>(`${actId(opts.adAccountId)}/campaigns`, {
        access_token: opts.token,
        fields: "id,status,effective_status",
        limit: "50",
      });
      published = (res?.data ?? []).length;
    } catch (e: any) {
      metaError = e?.message ?? String(e);
    }

    if (metaError) {
      causes.push({ code: "meta_error", message: metaError });
    } else if (published === 0) {
      // Nothing live on Meta: check whether drafts exist locally to be precise.
      const { count } = await (supabaseAdmin.from("meta_ads_campaigns" as any) as any)
        .select("id", { count: "exact", head: true })
        .eq("client_id", opts.clientId)
        .is("fb_campaign_id", null);
      causes.push({
        code: "no_published_campaigns",
        message:
          (count ?? 0) > 0
            ? "No hay campañas publicadas en Meta. Las campañas guardadas están en borrador, así que no hay gasto que traer."
            : "No hay campañas publicadas en Meta, así que no hay gasto que traer.",
      });
    } else {
      causes.push({
        code: "no_spend_in_window",
        message: `Las campañas no registraron gasto entre ${opts.from} y ${opts.to}. Prueba otro rango.`,
      });
    }
  }

  if (opts.postRows === 0 && opts.igAccountId) {
    try {
      const prof = await graph<any>(opts.igAccountId, {
        access_token: opts.token,
        fields: "media_count",
      });
      if (Number(prof?.media_count ?? 0) === 0) {
        causes.push({
          code: "no_media",
          message:
            "La cuenta de Instagram no tiene publicaciones, así que no hay métricas de contenido.",
        });
      } else {
        causes.push({
          code: "no_media_in_window",
          message: `Las publicaciones de Instagram no registraron métricas entre ${opts.from} y ${opts.to}. Prueba otro rango.`,
        });
      }
    } catch (e: any) {
      causes.push({ code: "meta_error", message: e?.message ?? String(e) });
    }
  }

  return causes;
}

/** Live token check + ad account metadata, cached on meta_accounts. */
export async function refreshAccountFacts(
  account: {
    id: string;
    ad_account_id: string | null;
    token_expires_at?: string | null;
  },
  token: string,
) {
  const patch: Record<string, unknown> = { last_validated_at: new Date().toISOString() };

  try {
    const res = await graph<any>("debug_token", { input_token: token, access_token: token });
    const info = res?.data ?? {};
    patch.token_valid = info?.is_valid !== false;
    if (Array.isArray(info?.scopes) && info.scopes.length > 0) patch.scopes = info.scopes;
    patch.token_expires_at = info?.expires_at
      ? new Date(info.expires_at * 1000).toISOString()
      : null;
  } catch {
    patch.token_valid = false;
  }

  if (account.ad_account_id) {
    try {
      const acct = await graph<any>(actId(account.ad_account_id), {
        access_token: token,
        fields: "currency,timezone_name",
      });
      if (acct?.currency) patch.currency = acct.currency;
      if (acct?.timezone_name) patch.timezone_name = acct.timezone_name;
    } catch {
      /* leave the cached values as they are */
    }
  }

  await (supabaseAdmin.from("meta_accounts" as any) as any).update(patch).eq("id", account.id);
  return patch;
}
