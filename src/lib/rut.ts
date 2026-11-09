/**
 * RUT chileno: limpieza, validación con módulo 11 y formato "12.345.678-5".
 *
 * Acepta con o sin puntos y con o sin guion. El dígito verificador puede ser
 * un dígito del 0 al 9 o la letra K (mayúscula o minúscula).
 */

/** Deja solo dígitos y la K (en mayúscula). */
export function limpiarRut(valor: string): string {
  return valor.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Dígito verificador (módulo 11) de un cuerpo numérico. */
export function digitoVerificadorRut(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/**
 * Valida un RUT chileno: normaliza puntos y guion, calcula el dígito verificador
 * con el algoritmo módulo 11 y lo compara con el DV informado. Devuelve `true`
 * solo si el RUT es válido.
 */
export function validarRutChileno(valor: string): boolean {
  const limpio = limpiarRut(valor);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return digitoVerificadorRut(cuerpo) === dv;
}

/** "123456785" → "12.345.678-5". Devuelve el valor original (trim) si no es un RUT válido. */
export function formatearRut(valor: string): string {
  if (!validarRutChileno(valor)) return valor.trim();
  const limpio = limpiarRut(valor);
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${limpio.slice(-1)}`;
}
