/**
 * Mensajes de error de Supabase Auth (vienen en inglés) en español de Chile,
 * para las pantallas de login y nueva contraseña.
 */
const AUTH_MESSAGES: ReadonlyArray<{ match: RegExp; message: string }> = [
  { match: /invalid login credentials/i, message: "El email o la contraseña no coinciden." },
  {
    match: /email not confirmed/i,
    message: "Aún no confirmas tu email. Revisa tu correo y abre el enlace de confirmación.",
  },
  {
    match: /rate limit|too many requests|security purposes/i,
    message: "Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo.",
  },
  {
    match: /should be different|same as the old/i,
    message: "La nueva contraseña debe ser distinta a la anterior.",
  },
  {
    match: /password should be at least|weak password/i,
    message: "La contraseña es muy corta: usa al menos 6 caracteres.",
  },
  {
    match: /session.*missing|expired|invalid.*token/i,
    message: "El enlace expiró. Pide uno nuevo desde «¿Olvidaste tu contraseña?».",
  },
  {
    match: /failed to fetch|network/i,
    message: "No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.",
  },
];

export const AUTH_FALLBACK_MESSAGE = "Algo salió mal. Intenta de nuevo en unos segundos.";

export function authErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return AUTH_MESSAGES.find((m) => m.match.test(raw))?.message ?? AUTH_FALLBACK_MESSAGE;
}
