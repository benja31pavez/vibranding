// Server-only: verifies that a stored Meta token can actually read the assets
// assigned to a client. Raw Meta errors are preserved so the UI can show them.
import { graph } from "@/lib/meta/oauth.server";

export type CheckResult = { ok: boolean; detail: string; error?: string };
export type MetaValidation = {
  ok: boolean;
  token: CheckResult;
  adAccount: CheckResult;
  instagram: CheckResult;
};

const skipped = (why: string): CheckResult => ({ ok: true, detail: why });

async function check(label: string, run: () => Promise<string>): Promise<CheckResult> {
  try {
    return { ok: true, detail: await run() };
  } catch (e: any) {
    return { ok: false, detail: label, error: e?.message ?? String(e) };
  }
}

export async function validateMetaAssets(opts: {
  token: string;
  adAccountId: string | null;
  igAccountId: string | null;
}): Promise<MetaValidation> {
  const token = await check("Token no válido", async () => {
    const res = await graph<any>("debug_token", {
      input_token: opts.token,
      access_token: opts.token,
    });
    const info = res?.data ?? {};
    if (info?.is_valid === false) {
      throw new Error(info?.error?.message ?? "Meta reporta el token como inválido");
    }
    const scopes: string[] = Array.isArray(info?.scopes) ? info.scopes : [];
    return scopes.length > 0 ? `Permisos: ${scopes.join(", ")}` : "Token válido";
  });

  const adAccount = opts.adAccountId
    ? await check("Cuenta publicitaria no legible", async () => {
        const res = await graph<any>(opts.adAccountId!, {
          access_token: opts.token,
          fields: "id,name,currency,account_status",
        });
        return `${res?.name ?? res?.id} · ${res?.currency ?? "—"}`;
      })
    : skipped("Sin cuenta publicitaria asignada");

  const instagram = opts.igAccountId
    ? await check("Instagram no legible", async () => {
        const res = await graph<any>(opts.igAccountId!, {
          access_token: opts.token,
          fields: "id,username,followers_count",
        });
        return `@${res?.username ?? res?.id}`;
      })
    : skipped("Sin cuenta de Instagram asignada");

  return {
    ok: token.ok && adAccount.ok && instagram.ok,
    token,
    adAccount,
    instagram,
  };
}
