// Reglas puras de la conexión única de la agencia (MCC). Sin red ni BD.
import { flattenSearchStream, normalizeCustomerId } from "@/lib/google-ads/gaql";

/** Datos de la cuenta raíz para saber si es administradora (MCC). */
export const MANAGER_CHECK_QUERY =
  "SELECT customer.id, customer.descriptive_name, customer.manager FROM customer";

/**
 * Jerarquía completa bajo la MCC (customer_client incluye todos los niveles
 * cuando se consulta desde la raíz con login-customer-id = MCC).
 */
export const AGENCY_HIERARCHY_QUERY = [
  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager,",
  "customer_client.level, customer_client.status, customer_client.currency_code,",
  "customer_client.time_zone",
  "FROM customer_client",
].join(" ");

export type AuthSource = "cliente" | "agencia";

export type ManagerCandidate = { customerId: string; name: string | null };

/** Fila de MANAGER_CHECK_QUERY → candidato si la cuenta es MCC. */
export function parseManagerCandidate(body: unknown): ManagerCandidate | null {
  const c = (flattenSearchStream(body)[0] as { customer?: Record<string, unknown> } | undefined)
    ?.customer;
  if (!c || c.manager !== true) return null;
  const id = normalizeCustomerId(c.id != null ? String(c.id) : null);
  if (!id) return null;
  const name = typeof c.descriptiveName === "string" ? c.descriptiveName.trim() : "";
  return { customerId: id, name: name || null };
}

/**
 * Qué MCC queda como la de la agencia:
 * - si `preferredId` (GOOGLE_ADS_LOGIN_CUSTOMER_ID) es una de las MCC, esa;
 * - si hay exactamente una MCC, esa;
 * - si hay varias, null (el dueño elige en Configuración);
 * - si no hay ninguna, "none".
 */
export function chooseAgencyManager(
  managers: readonly ManagerCandidate[],
  preferredId: string | null,
): ManagerCandidate | null | "none" {
  if (managers.length === 0) return "none";
  const preferred = preferredId ? managers.find((m) => m.customerId === preferredId) : undefined;
  if (preferred) return preferred;
  return managers.length === 1 ? managers[0] : null;
}

export type AgencyConnectionLike = {
  status: string;
  manager_customer_id: string | null;
  token_secret_id: string | null;
} | null;

export type AccountAuthLike = {
  auth_source: string | null;
  token_secret_id: string | null;
  manager_customer_id: string | null;
};

export type AuthPlan =
  | { source: AuthSource; loginCustomerId: string | null }
  | { error: string; needsReconnect: boolean };

/** La conexión de la agencia sirve para leer cuentas: conectada, con MCC y token. */
export function isAgencyReady(agency: AgencyConnectionLike): boolean {
  return Boolean(
    agency &&
    agency.status === "conectada" &&
    normalizeCustomerId(agency.manager_customer_id) &&
    agency.token_secret_id,
  );
}

/**
 * Con qué token y login-customer-id se lee una cuenta vinculada:
 * - 'cliente' (compatibilidad): token propio y la MCC guardada en la fila;
 * - 'agencia': token de la MCC de la agencia y login-customer-id = esa MCC.
 */
export function resolveAuthPlan(account: AccountAuthLike, agency: AgencyConnectionLike): AuthPlan {
  if (account.auth_source === "agencia") {
    if (!isAgencyReady(agency)) {
      return {
        error:
          "La conexión de Google Ads de la agencia (MCC) no está activa. Reconéctala en Configuración → Google Ads.",
        needsReconnect: true,
      };
    }
    return { source: "agencia", loginCustomerId: agency!.manager_customer_id };
  }
  if (!account.token_secret_id) {
    return { error: "No hay token guardado. Vuelve a conectar Google Ads.", needsReconnect: true };
  }
  return { source: "cliente", loginCustomerId: account.manager_customer_id };
}
