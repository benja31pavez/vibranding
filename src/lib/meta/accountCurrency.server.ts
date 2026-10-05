import { graphBase } from "@/lib/meta/version";
import { MetaCurrencyError, getMetaCurrencyOffset } from "@/lib/meta/currency";

/** Reads the ad account's currency live from Meta; null when Meta can't be reached. */
export async function fetchLiveAdAccountCurrency(
  adAccountId: string,
  token: string,
): Promise<string | null> {
  try {
    const url = `${graphBase()}/${adAccountId}?fields=currency&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[meta-currency] no se pudo leer la moneda de", adAccountId, res.status);
      return null;
    }
    const body = (await res.json()) as { currency?: string };
    const code = (body?.currency ?? "").trim().toUpperCase();
    return code || null;
  } catch (e) {
    console.error("[meta-currency] error leyendo la moneda de", adAccountId, e);
    return null;
  }
}

/**
 * Resolves the ad account's currency for budget conversion.
 * Meta's live value is the source of truth; the cached `meta_accounts.currency`
 * is only a fallback when Meta can't be reached. Throws when neither is known
 * or the currency has no documented offset (never guesses).
 */
export async function resolveAdAccountCurrency(
  adAccountId: string,
  token: string,
  cachedCurrency: string | null | undefined,
): Promise<string> {
  const live = await fetchLiveAdAccountCurrency(adAccountId, token);
  const currency = (live ?? cachedCurrency ?? "").trim().toUpperCase();
  if (!currency) {
    throw new MetaCurrencyError(
      "No se pudo determinar la moneda de la cuenta publicitaria; no se envían presupuestos a Meta.",
    );
  }
  getMetaCurrencyOffset(currency); // fail closed on unknown currencies
  return currency;
}
