// Códigos cortos que el callback de OAuth deja en la URL (?gads_error=…).
// Nunca se pone texto crudo de la API en la URL: el navegador los traduce aquí.

export const GOOGLE_OAUTH_ERRORS = {
  no_refresh_token:
    "Google no entregó un acceso permanente. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar.",
  no_accounts: "Esta cuenta de Google no tiene acceso a ninguna cuenta de Google Ads.",
  no_free_accounts:
    "No hay cuentas en CLP libres: las accesibles son administradoras (MCC), están en otra moneda o ya están vinculadas a otros clientes.",
  forbidden: "Tu rol no permite conectar Google Ads en este cliente.",
  token_exchange: "Google rechazó la autorización. Vuelve a intentarlo.",
  google_api:
    "Google Ads respondió con un error al buscar las cuentas. Vuelve a intentarlo en unos minutos.",
  save_failed: "No se pudo guardar la conexión. Vuelve a intentarlo.",
  account_taken: "Esa cuenta de Google Ads ya está vinculada a otro cliente.",
  sync_failed:
    "Conectado, pero la primera descarga de métricas falló. Usa «Actualizar ahora» para reintentar.",
  no_manager:
    "Esa cuenta de Google no administra ninguna cuenta de administrador (MCC). Inicia sesión con el Google que administra la MCC de la agencia.",
  unknown: "No se pudo conectar con Google.",
} as const;

export type GoogleOAuthErrorCode = keyof typeof GOOGLE_OAUTH_ERRORS;

export function googleOAuthErrorMessage(code: string | null): string {
  return code && code in GOOGLE_OAUTH_ERRORS
    ? GOOGLE_OAUTH_ERRORS[code as GoogleOAuthErrorCode]
    : GOOGLE_OAUTH_ERRORS.unknown;
}
