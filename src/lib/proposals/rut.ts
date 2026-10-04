/**
 * RUT chileno: limpieza, validación módulo 11 y formato "12.345.678-5".
 * Acepta con o sin puntos/guion y DV "k" minúscula.
 */

/** Deja solo dígitos y K (mayúscula). */
export function cleanRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Dígito verificador (módulo 11) de un cuerpo numérico. */
export function rutCheckDigit(body: string): string {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  if (rest === 11) return "0";
  if (rest === 10) return "K";
  return String(rest);
}

export function isValidRut(value: string): boolean {
  const clean = cleanRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return rutCheckDigit(body) === dv;
}

/** "123456785" → "12.345.678-5". Devuelve el valor original si no es un RUT válido. */
export function formatRut(value: string): string {
  if (!isValidRut(value)) return value.trim();
  const clean = cleanRut(value);
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${clean.slice(-1)}`;
}
