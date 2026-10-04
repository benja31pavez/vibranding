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
 */
import { hmacSha256Hex } from "@/lib/crypto";

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

export class FlowNotConfiguredError extends Error {
  constructor() {
    super("Flow no está configurado (faltan FLOW_API_KEY / FLOW_SECRET_KEY)");
    this.name = "FlowNotConfiguredError";
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

export function isFlowConfigured(): boolean {
  return Boolean(process.env.FLOW_API_KEY?.trim() && process.env.FLOW_SECRET_KEY?.trim());
}

function flowConfig(): FlowConfig {
  const apiKey = process.env.FLOW_API_KEY?.trim();
  const secretKey = process.env.FLOW_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) throw new FlowNotConfiguredError();
  const apiUrl = (process.env.FLOW_API_URL?.trim() || FLOW_SANDBOX_URL).replace(/\/$/, "");
  return { apiKey, secretKey, apiUrl };
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
    throw new FlowApiError(
      `Flow rechazó la solicitud (${service}): ${err.message ?? `HTTP ${res.status}`}`,
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
