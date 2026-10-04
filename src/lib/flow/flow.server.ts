/**
 * Cliente mínimo de la API REST de Flow (flow.cl), compatible con Workers
 * (solo fetch + Web Crypto).
 *
 * Verificado contra la especificación oficial (https://www.flow.cl/docs/apiFlow.yaml):
 *  - Base URL: producción https://www.flow.cl/api · sandbox https://sandbox.flow.cl/api
 *  - Firma: todos los parámetros salvo `s`, ordenados alfabéticamente por nombre,
 *    concatenados como nombre+valor y firmados con HMAC-SHA256 (hex) usando la
 *    secretKey. La firma va en el parámetro `s`.
 *  - POST /payment/create (x-www-form-urlencoded). Requeridos: apiKey,
 *    commerceOrder, subject, amount, email, urlConfirmation, urlReturn, s.
 *    Respuesta { url, token, flowOrder }; link de pago = url + "?token=" + token.
 *  - GET /payment/getStatus?apiKey&token&s → PaymentStatus
 *    (status 1 pendiente, 2 pagada, 3 rechazada, 4 anulada).
 *  - Errores: HTTP 400/401 con { code, message }.
 *
 * Variables de entorno (las tres son obligatorias; si falta alguna, Flow se
 * considera NO configurado y la app no ofrece "Generar link de pago"):
 *  - FLOW_API_KEY / FLOW_SECRET_KEY: credenciales del comercio en Flow.
 *  - FLOW_API_URL: a qué ambiente se habla. Valores válidos:
 *      producción → https://www.flow.cl/api
 *      pruebas    → https://sandbox.flow.cl/api
 *    No hay valor por defecto a propósito: antes caía en sandbox y en
 *    producción eso generaba links de prueba que el cliente no podía pagar.
 */
import { hmacSha256Hex } from "@/lib/crypto";

export const FLOW_PRODUCTION_URL = "https://www.flow.cl/api";
export const FLOW_SANDBOX_URL = "https://sandbox.flow.cl/api";

/** Estados de una orden en Flow (PaymentStatus.status). */
export const FLOW_STATUS = {
  PENDING: 1,
  PAID: 2,
  REJECTED: 3,
  CANCELLED: 4,
} as const;

/** Sin timeout explícito una orden de Flow no expira nunca. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Mensaje para cualquier usuario: no nombra variables de entorno. */
export const FLOW_NOT_CONFIGURED_MESSAGE =
  "Flow no está conectado. Pide a un administrador que lo configure para cobrar online.";

export class FlowNotConfiguredError extends Error {
  /** Variables que faltan (solo para logs y administradores de plataforma). */
  readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(FLOW_NOT_CONFIGURED_MESSAGE);
    this.name = "FlowNotConfiguredError";
    this.missing = missing;
  }
  /** Detalle técnico, p. ej. "Falta FLOW_API_URL". */
  get adminDetail(): string {
    return `Falta ${this.missing.join(", ")}`;
  }
}

export class FlowApiError extends Error {
  readonly httpStatus: number;
  readonly code: number | null;
  constructor(message: string, httpStatus: number, code: number | null = null) {
    super(message);
    this.name = "FlowApiError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

interface FlowConfig {
  apiKey: string;
  secretKey: string;
  apiUrl: string;
}

const FLOW_ENV_VARS = ["FLOW_API_KEY", "FLOW_SECRET_KEY", "FLOW_API_URL"] as const;

/** Variables de Flow ausentes o vacías (FLOW_API_URL además debe ser https). */
export function missingFlowConfig(): string[] {
  return FLOW_ENV_VARS.filter((name) => {
    const value = process.env[name]?.trim();
    if (!value) return true;
    return name === "FLOW_API_URL" && !/^https:\/\//i.test(value);
  });
}

export function isFlowConfigured(): boolean {
  return missingFlowConfig().length === 0;
}

function flowConfig(): FlowConfig {
  const missing = missingFlowConfig();
  if (missing.length > 0) throw new FlowNotConfiguredError(missing);
  return {
    apiKey: (process.env.FLOW_API_KEY ?? "").trim(),
    secretKey: (process.env.FLOW_SECRET_KEY ?? "").trim(),
    apiUrl: (process.env.FLOW_API_URL ?? "").trim().replace(/\/$/, ""),
  };
}

type FlowParams = Readonly<Record<string, string | number | undefined | null>>;

/** Quita vacíos y convierte a string (lo que se firma es exactamente lo que se envía). */
function normalizeParams(params: FlowParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
}

/** String a firmar según Flow: claves ordenadas ascendente, "clavevalor" concatenado, sin `s`. */
export function flowStringToSign(params: Readonly<Record<string, string>>): string {
  return Object.keys(params)
    .filter((k) => k !== "s")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
}

export async function signFlowParams(
  params: Readonly<Record<string, string>>,
  secretKey: string,
): Promise<string> {
  return hmacSha256Hex(secretKey, flowStringToSign(params));
}

async function signed(params: FlowParams, cfg: FlowConfig): Promise<URLSearchParams> {
  const withKey = normalizeParams({ ...params, apiKey: cfg.apiKey });
  const s = await signFlowParams(withKey, cfg.secretKey);
  return new URLSearchParams({ ...withKey, s });
}

async function parseFlowResponse<T>(res: Response, service: string): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = (body ?? {}) as { code?: number; message?: string };
    console.error(`[flow] ${service} HTTP ${res.status}`, err.message ?? text.slice(0, 200));
    // El detalle de Flow queda en el log; al navegador solo va un mensaje genérico.
    throw new FlowApiError(
      "Flow rechazó la solicitud. Inténtalo de nuevo o revisa la configuración de Flow.",
      res.status,
      typeof err.code === "number" ? err.code : null,
    );
  }
  if (!body || typeof body !== "object") {
    throw new FlowApiError(`Respuesta inválida de Flow (${service})`, res.status);
  }
  return body as T;
}

async function flowFetch<T>(service: string, init: { method: "GET" | "POST"; params: FlowParams }) {
  const cfg = flowConfig();
  const qs = await signed(init.params, cfg);
  const url = `${cfg.apiUrl}/${service}`;
  const res = await fetch(init.method === "GET" ? `${url}?${qs.toString()}` : url, {
    method: init.method,
    headers:
      init.method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: init.method === "POST" ? qs.toString() : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return parseFlowResponse<T>(res, service);
}

export interface CreateFlowPaymentInput {
  commerceOrder: string;
  subject: string;
  /** Entero en CLP. */
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
  /** Segundos hasta que la orden expire. Sin valor, no expira. */
  timeout?: number;
}

export interface CreateFlowPaymentResult {
  token: string;
  flowOrder: number;
  /** Link listo para enviar al pagador: url + "?token=" + token. */
  paymentUrl: string;
}

export async function createFlowPayment(
  input: CreateFlowPaymentInput,
): Promise<CreateFlowPaymentResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("El monto para Flow debe ser un entero positivo en CLP");
  }
  const res = await flowFetch<{ url?: string; token?: string; flowOrder?: number }>(
    "payment/create",
    {
      method: "POST",
      params: {
        commerceOrder: input.commerceOrder,
        subject: input.subject.slice(0, 255),
        currency: "CLP",
        amount: input.amount,
        email: input.email,
        urlConfirmation: input.urlConfirmation,
        urlReturn: input.urlReturn,
        timeout: input.timeout,
      },
    },
  );
  if (!res.url || !res.token) throw new FlowApiError("Flow no devolvió url/token", 502);
  return {
    token: res.token,
    flowOrder: Number(res.flowOrder ?? 0),
    paymentUrl: `${res.url}?token=${encodeURIComponent(res.token)}`,
  };
}

export interface FlowPaymentStatus {
  flowOrder: number;
  commerceOrder: string;
  /** "yyyy-mm-dd hh:mm:ss" */
  requestDate?: string;
  status: number;
  currency: string;
  amount: number;
  payer?: string;
  paymentData?: { date?: string | null; media?: string | null; amount?: number | null } | null;
}

export async function getFlowPaymentStatus(token: string): Promise<FlowPaymentStatus> {
  if (!token) throw new Error("Falta el token de Flow");
  return flowFetch<FlowPaymentStatus>("payment/getStatus", { method: "GET", params: { token } });
}
