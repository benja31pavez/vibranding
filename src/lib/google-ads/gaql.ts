// Utilidades puras de Google Ads (sin red ni BD): se pueden probar en local.
//
// Respuesta REST de googleAds:searchStream: un arreglo JSON de lotes
// [{ results: [...], fieldMask, requestId }]. Los int64 (impressions, clicks,
// costMicros, ids) llegan como string; conversions es double.
// Docs: https://developers.google.com/google-ads/api/rest/common/search

/** Un millón de micros = 1 unidad de la moneda de la cuenta. */
export const MICROS_PER_UNIT = 1_000_000;

const CUSTOMER_ID_RE = /^\d{10}$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "123-456-7890" o "customers/1234567890" → "1234567890"; null si no son 10 dígitos. */
export function normalizeCustomerId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw)
    .replace(/^customers\//, "")
    .replace(/-/g, "")
    .trim();
  return CUSTOMER_ID_RE.test(digits) ? digits : null;
}

/** "1234567890" → "123-456-7890" (como lo muestra Google Ads). */
export function formatCustomerId(id: string): string {
  return CUSTOMER_ID_RE.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}

/**
 * cost_micros → pesos chilenos. El CLP no tiene decimales: se redondea al peso.
 * Ej.: 1_234_567_890 micros → $1.235 CLP.
 */
export function microsToClp(micros: string | number | null | undefined): number {
  const n = Number(micros ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n / MICROS_PER_UNIT);
}

function toInt(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function toDecimal(v: unknown): number {
  const n = Number(v ?? 0);
  // Conversiones pueden ser fraccionarias (modelos de atribución): 2 decimales.
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** Consulta GAQL de métricas diarias por campaña (solo lectura). */
export function buildCampaignDailyQuery(from: string, to: string): string {
  if (!YMD_RE.test(from) || !YMD_RE.test(to)) throw new Error("Fechas inválidas (YYYY-MM-DD)");
  return [
    "SELECT campaign.id, campaign.name, segments.date,",
    "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions",
    "FROM campaign",
    `WHERE segments.date BETWEEN '${from}' AND '${to}'`,
  ].join(" ");
}

/** Consulta de la cuenta y sus subcuentas directas (para elegir cuenta). */
export const CUSTOMER_CLIENTS_QUERY = [
  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager,",
  "customer_client.level, customer_client.status, customer_client.currency_code,",
  "customer_client.time_zone",
  "FROM customer_client",
  "WHERE customer_client.level <= 1",
].join(" ");

/** Moneda de la cuenta (la plataforma trabaja solo en CLP). */
export const CUSTOMER_CURRENCY_QUERY = "SELECT customer.id, customer.currency_code FROM customer";

type Num = string | number | null | undefined;

/** Fila de searchStream (JSON REST, camelCase). Solo los campos que se usan. */
export type GaqlRow = {
  campaign?: { id?: Num; name?: string };
  segments?: { date?: string };
  metrics?: { impressions?: Num; clicks?: Num; costMicros?: Num; conversions?: Num };
  customer?: { id?: Num; currencyCode?: string };
  customerClient?: {
    id?: Num;
    descriptiveName?: string;
    manager?: boolean;
    level?: Num;
    status?: string;
    currencyCode?: string;
    timeZone?: string;
  };
};

export type SearchStreamBatch = { results?: GaqlRow[] };

/** Aplana los lotes de searchStream en una lista de filas. */
export function flattenSearchStream(body: unknown): GaqlRow[] {
  const batches: SearchStreamBatch[] = Array.isArray(body)
    ? body
    : body
      ? [body as SearchStreamBatch]
      : [];
  return batches.flatMap((b) => (Array.isArray(b?.results) ? b.results : []));
}

export type CampaignDailyRow = {
  campaign_id: string;
  campaign_name: string | null;
  date: string;
  impressions: number;
  clicks: number;
  cost_clp: number;
  conversions: number;
};

/**
 * Filas de searchStream → filas de google_ads_insights_daily (sin client_id).
 * Descarta filas sin campaña o sin fecha válida y suma duplicados de la misma
 * campaña y día para que el upsert no choque consigo mismo.
 */
export function parseCampaignDailyRows(body: unknown): CampaignDailyRow[] {
  const byKey = new Map<string, CampaignDailyRow & { micros: number }>();
  for (const r of flattenSearchStream(body)) {
    const campaignId = r?.campaign?.id != null ? String(r.campaign.id) : "";
    const date = String(r?.segments?.date ?? "");
    if (!/^\d+$/.test(campaignId) || !YMD_RE.test(date)) continue;
    const key = `${campaignId}|${date}`;
    const micros = Number(r?.metrics?.costMicros ?? 0);
    const prev = byKey.get(key);
    const next = {
      campaign_id: campaignId,
      campaign_name: (r?.campaign?.name as string | undefined) ?? prev?.campaign_name ?? null,
      date,
      impressions: (prev?.impressions ?? 0) + toInt(r?.metrics?.impressions),
      clicks: (prev?.clicks ?? 0) + toInt(r?.metrics?.clicks),
      conversions: toDecimal((prev?.conversions ?? 0) + toDecimal(r?.metrics?.conversions)),
      micros: (prev?.micros ?? 0) + (Number.isFinite(micros) && micros > 0 ? micros : 0),
      cost_clp: 0,
    };
    byKey.set(key, next);
  }
  // Se redondea una sola vez sobre el total de micros, no por fila.
  return [...byKey.values()].map(({ micros, ...row }) => ({
    ...row,
    cost_clp: microsToClp(micros),
  }));
}

export type CustomerOption = {
  customerId: string;
  name: string | null;
  /** Cuenta administradora (MCC) por la que se accede; va en login-customer-id. */
  managerId: string | null;
  isManager: boolean;
  currency: string | null;
  timeZone: string | null;
};

/** Filas de customer_client consultadas desde `rootId` → opciones de cuenta. */
export function parseCustomerClients(rootId: string, body: unknown): CustomerOption[] {
  const out: CustomerOption[] = [];
  for (const r of flattenSearchStream(body)) {
    const c = r?.customerClient ?? {};
    const id = normalizeCustomerId(c.id != null ? String(c.id) : null);
    if (!id) continue;
    if (c.status && c.status !== "ENABLED") continue;
    const level = Number(c.level ?? 0);
    out.push({
      customerId: id,
      name: (c.descriptiveName as string | undefined) || null,
      managerId: level === 0 || id === rootId ? null : rootId,
      isManager: Boolean(c.manager),
      currency: (c.currencyCode as string | undefined) ?? null,
      timeZone: (c.timeZone as string | undefined) ?? null,
    });
  }
  return out;
}

/** Une opciones de varias cuentas raíz; si una cuenta aparece dos veces gana el acceso directo. */
export function mergeCustomerOptions(lists: CustomerOption[][]): CustomerOption[] {
  const byId = new Map<string, CustomerOption>();
  for (const opt of lists.flat()) {
    const prev = byId.get(opt.customerId);
    if (!prev || (prev.managerId && !opt.managerId)) byId.set(opt.customerId, opt);
  }
  return [...byId.values()].sort(
    (a, b) =>
      Number(a.isManager) - Number(b.isManager) || (a.name ?? "").localeCompare(b.name ?? ""),
  );
}

/** Mensaje legible de un error REST de Google Ads (sin filtrar tokens). */
type ApiErrorBody = {
  error?: {
    message?: string;
    details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[];
  };
};

export function googleAdsErrorMessage(body: unknown, status: number): string {
  const first = (Array.isArray(body) ? body[0] : body) as ApiErrorBody | null | undefined;
  const err = first?.error;
  const detail = err?.details?.[0]?.errors?.[0];
  const code = detail?.errorCode ? Object.values(detail.errorCode)[0] : null;
  const msg = detail?.message ?? err?.message ?? `HTTP ${status}`;
  return code ? `${msg} (${String(code)})` : String(msg);
}

/** Cuenta elegible para vincular a un cliente: no MCC y en pesos chilenos. */
export function isLinkable(opt: CustomerOption): boolean {
  return !opt.isManager && opt.currency === "CLP";
}

/**
 * Elige la cuenta tras el OAuth. `taken` = cuentas ya vinculadas a otros clientes.
 * - Si la cuenta que ya tenía el cliente sigue accesible, se mantiene.
 * - Si hay exactamente una cuenta elegible libre, se vincula sola.
 * - Si hay varias, se reserva la primera como "pendiente" hasta que se elija.
 */
export function chooseInitialCustomer(
  options: CustomerOption[],
  taken: ReadonlySet<string>,
  currentCustomerId: string | null,
): { option: CustomerOption; confirmed: boolean } | null {
  const free = options.filter((o) => isLinkable(o) && !taken.has(o.customerId));
  const current = currentCustomerId
    ? free.find((o) => o.customerId === currentCustomerId)
    : undefined;
  if (current) return { option: current, confirmed: true };
  if (free.length === 0) return null;
  return { option: free[0], confirmed: free.length === 1 };
}
