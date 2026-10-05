// Descubrimiento de cuentas de Google Ads accesibles para el usuario que autorizó.
import type { GoogleAdsConfig } from "@/lib/google-ads/config.server";
import { listAccessibleCustomers, searchStream } from "@/lib/google-ads/client.server";
import {
  CUSTOMER_CLIENTS_QUERY,
  mergeCustomerOptions,
  parseCustomerClients,
  type CustomerOption,
} from "@/lib/google-ads/gaql";

/**
 * Tope de cuentas raíz a explorar: cada una es una llamada a la API y el Worker
 * tiene límite de subrequests por invocación.
 */
const MAX_ROOTS = 15;

export type DiscoveryResult = { options: CustomerOption[]; errors: string[] };

/**
 * listAccessibleCustomers solo devuelve las cuentas con acceso directo. Si una
 * es MCC, sus subcuentas directas (customer_client nivel 1) también se ofrecen,
 * usando esa MCC como login-customer-id.
 * https://developers.google.com/google-ads/api/docs/account-management/listing-accounts
 */
export async function discoverCustomers(
  cfg: GoogleAdsConfig,
  accessToken: string,
): Promise<DiscoveryResult> {
  const accessible = await listAccessibleCustomers(cfg, accessToken);
  const roots = [
    ...new Set([...(cfg.loginCustomerId ? [cfg.loginCustomerId] : []), ...accessible]),
  ].slice(0, MAX_ROOTS);

  const errors: string[] = [];
  const lists = await Promise.all(
    roots.map(async (rootId) => {
      try {
        const body = await searchStream(cfg, accessToken, rootId, CUSTOMER_CLIENTS_QUERY, rootId);
        return parseCustomerClients(rootId, body);
      } catch (e) {
        // Cuentas canceladas o sin permiso: se informan, no cortan el resto.
        errors.push(`${rootId}: ${(e as Error).message}`);
        return [];
      }
    }),
  );
  if (accessible.length > MAX_ROOTS) {
    errors.push(
      `Se revisaron solo las primeras ${MAX_ROOTS} de ${accessible.length} cuentas accesibles.`,
    );
  }
  return { options: mergeCustomerOptions(lists), errors };
}
