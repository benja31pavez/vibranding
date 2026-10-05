/**
 * Estado combinado del "Pago de pauta" por plataforma (lógica pura).
 *
 * Junta lo que el cliente declaró en el onboarding ("Ya agregué mi tarjeta")
 * con la verificación automática (Meta: meta_billing_status; Google:
 * google_ads_billing_status si existe). La verificación manda sobre lo declarado.
 */

export const ADS_PLATFORMS = ["google", "meta"] as const;
export type AdsPlatform = (typeof ADS_PLATFORMS)[number];

export const ADS_PLATFORM_LABEL: Readonly<Record<AdsPlatform, string>> = {
  google: "Google Ads",
  meta: "Meta Ads",
};

/** Resultado de la verificación automática (null = nunca se verificó / no hay datos). */
export type AdsVerification = "verified" | "rejected" | null;

export type AdsBillingState = "verificado" | "pendiente" | "rechazado" | "sin_cuenta";

export const ADS_BILLING_STATE_LABEL: Readonly<Record<AdsBillingState, string>> = {
  verificado: "Verificado",
  pendiente: "Pendiente",
  rechazado: "Rechazado",
  sin_cuenta: "Sin cuenta",
};

export interface CombineInput {
  /** Fecha en que el cliente marcó "Ya agregué mi tarjeta" (null si no). */
  selfReportedAt: string | null;
  /** Hay una cuenta publicitaria enlazada en la plataforma. */
  linked: boolean;
  verification: AdsVerification;
}

export function combineAdsBillingState(input: CombineInput): AdsBillingState {
  if (input.verification === "rejected") return "rechazado";
  if (input.verification === "verified") return "verificado";
  if (input.selfReportedAt || input.linked) return "pendiente";
  return "sin_cuenta";
}

/** Texto de ayuda bajo el chip. */
export function adsBillingHint(state: AdsBillingState, input: CombineInput): string {
  switch (state) {
    case "verificado":
      return "Cuenta activa y con medio de pago.";
    case "rechazado":
      return "La plataforma reporta un problema de pago.";
    case "pendiente":
      return input.selfReportedAt
        ? "El cliente dice que agregó su tarjeta; falta verificarla."
        : "Cuenta enlazada; aún sin verificación de pago.";
    default:
      return "Sin cuenta enlazada ni tarjeta declarada.";
  }
}

// ------------------------------------------------------------------ lectura tolerante

const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;

/** client_intake.ads_billing_self_reported → fechas por plataforma (tolera columnas ausentes). */
export function parseSelfReported(raw: unknown): Record<AdsPlatform, string | null> {
  const out: Record<AdsPlatform, string | null> = { google: null, meta: null };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const p of ADS_PLATFORMS) {
    const v = r[p];
    out[p] = typeof v === "string" && ISO_RE.test(v) ? v : null;
  }
  return out;
}

/** client_intake.ads_platforms → plataformas válidas (null si el cliente no respondió). */
export function parsePlatforms(raw: unknown): AdsPlatform[] | null {
  if (!Array.isArray(raw)) return null;
  return ADS_PLATFORMS.filter((p) => raw.includes(p));
}

/** Fila de meta_billing_status → verificación. */
export function metaVerification(
  row: { account_status: number | null; has_funding: boolean | null } | null,
): AdsVerification {
  if (!row) return null;
  if (row.account_status === 1 && row.has_funding === true) return "verified";
  if (row.account_status === 1 && row.has_funding === null) return null;
  return "rejected";
}

/** Un chequeo de Google más viejo que esto ya no cuenta como verificación. */
export const GOOGLE_BILLING_FRESH_MS = 72 * 3_600_000;

/**
 * Fila de google_ads_billing_status (PR #83): verdict
 * ('verificado'|'pendiente'|'rechazado'|'sin_cuenta'), has_valid_billing y
 * last_success_at. Rechazado manda; verificado solo si además hay facturación
 * válida y un chequeo exitoso de las últimas 72 h. Lo demás = sin dato.
 */
export function googleVerification(
  row: Record<string, unknown> | null,
  now: Date = new Date(),
): AdsVerification {
  if (!row) return null;
  if (row.verdict === "rechazado") return "rejected";
  if (row.verdict !== "verificado" || row.has_valid_billing !== true) return null;
  const last = typeof row.last_success_at === "string" ? Date.parse(row.last_success_at) : NaN;
  if (!Number.isFinite(last)) return null;
  const age = now.getTime() - last;
  return age >= 0 && age <= GOOGLE_BILLING_FRESH_MS ? "verified" : null;
}

// ------------------------------------------------------------------ vista de la ficha

export interface AdsBillingSources {
  intake: Record<string, unknown> | null;
  metaAdAccountId: string | null;
  metaStatus: { account_status: number | null; has_funding: boolean | null } | null;
  googleCustomerId: string | null;
  googleStatus: Record<string, unknown> | null;
}

export interface AdsBillingRow {
  platform: AdsPlatform;
  state: AdsBillingState;
  hint: string;
  /** El cliente eligió esta plataforma en el onboarding (null = no respondió). */
  chosen: boolean | null;
}

/** Una fila por plataforma con el estado combinado. */
export function adsBillingRows(src: AdsBillingSources, now: Date = new Date()): AdsBillingRow[] {
  const reported = parseSelfReported(src.intake?.ads_billing_self_reported);
  const chosen = parsePlatforms(src.intake?.ads_platforms);
  const inputs: Record<AdsPlatform, CombineInput> = {
    meta: {
      selfReportedAt: reported.meta,
      linked: Boolean(src.metaAdAccountId),
      verification: src.metaAdAccountId ? metaVerification(src.metaStatus) : null,
    },
    google: {
      selfReportedAt: reported.google,
      linked: Boolean(src.googleCustomerId),
      verification: src.googleCustomerId ? googleVerification(src.googleStatus, now) : null,
    },
  };
  return ADS_PLATFORMS.map((platform) => {
    const input = inputs[platform];
    const state = combineAdsBillingState(input);
    return {
      platform,
      state,
      hint: adsBillingHint(state, input),
      chosen: chosen ? chosen.includes(platform) : null,
    };
  });
}
