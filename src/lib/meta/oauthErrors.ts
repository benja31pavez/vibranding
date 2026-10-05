// Códigos cortos que el callback de OAuth de Meta deja en la URL (?meta_error=…).
// Nunca se pone texto crudo de la API en la URL: el navegador los traduce aquí.
// El detalle técnico queda en meta_accounts.last_sync_error (página de diagnóstico).

export const META_OAUTH_ERRORS = {
  forbidden: "Tu rol no permite conectar Meta en este cliente.",
  token_exchange: "Meta rechazó la autorización. Vuelve a intentarlo.",
  no_assets:
    "No se encontró ninguna cuenta publicitaria ni de Instagram con este acceso. Revisa permisos y roles en la app de Meta.",
  asset_taken:
    "La cuenta publicitaria o de Instagram ya está asignada a otro cliente. Desvincúlala de ese cliente antes de conectarla aquí.",
  save_failed: "No se pudo guardar la conexión. Vuelve a intentarlo.",
  partial:
    "Conectado con advertencias: Meta no entregó todas las cuentas. Revisa el diagnóstico de Meta del cliente.",
  unknown: "No se pudo conectar con Meta.",
} as const;

export type MetaOAuthErrorCode = keyof typeof META_OAUTH_ERRORS;

export function metaOAuthErrorMessage(code: string | null): string {
  return code && code in META_OAUTH_ERRORS
    ? META_OAUTH_ERRORS[code as MetaOAuthErrorCode]
    : META_OAUTH_ERRORS.unknown;
}
