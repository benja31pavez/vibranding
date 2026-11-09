/**
 * Catálogo de bancos chilenos y tipos de cuenta aceptados para datos de
 * transferencia bancaria. Lista mantenida a mano (CMF Chile).
 *
 * El orden sigue el uso en el mercado chileno: estatales y grandes privados
 * primero, bancos de nicho y extranjeros después.
 */

export const CHILEAN_BANKS = [
  "Banco Estado",
  "BCI",
  "Banco de Chile",
  "Banco Santander",
  "Banco Scotiabank Chile",
  "Banco Itaú Chile",
  "Banco Falabella",
  "Banco Security",
  "Banco BICE",
  "Banco Consorcio",
  "Banco Internacional",
  "Banco Ripley",
  "HSBC Bank Chile",
  "Banco Edwards",
  "China Construction Bank",
  "Coopeuch",
] as const;

export type ChileanBank = (typeof CHILEAN_BANKS)[number];

export const CHILEAN_ACCOUNT_TYPES = [
  "Cuenta corriente",
  "Cuenta vista",
  "Cuenta RUT",
  "Cuenta de ahorro",
] as const;

export type ChileanAccountType = (typeof CHILEAN_ACCOUNT_TYPES)[number];

export function isChileanBank(value: unknown): value is ChileanBank {
  return typeof value === "string" && (CHILEAN_BANKS as readonly string[]).includes(value);
}

export function isChileanAccountType(value: unknown): value is ChileanAccountType {
  return typeof value === "string" && (CHILEAN_ACCOUNT_TYPES as readonly string[]).includes(value);
}
