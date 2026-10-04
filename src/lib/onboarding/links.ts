/**
 * Links de redes del onboarding (client_intake.links_redes).
 *
 * La BD solo acepta "http(s)://..." o un nombre de usuario (@?[A-Za-z0-9._-]),
 * pero la UI NUNCA debe poner un valor en `href` sin validar el esquema:
 * usar siempre safeExternalHref().
 */

const PROFILE_BASE: Readonly<Record<string, string>> = {
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  tiktok: "https://www.tiktok.com/@",
  linkedin: "https://www.linkedin.com/in/",
  youtube: "https://www.youtube.com/@",
  x: "https://x.com/",
};

const USERNAME = /^@?[A-Za-z0-9._-]{1,100}$/;

/**
 * Devuelve un href seguro (solo http/https) o null si no se puede enlazar.
 * Un nombre de usuario se convierte en URL de perfil si la red es conocida.
 */
export function safeExternalHref(network: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (USERNAME.test(raw)) {
    const base = PROFILE_BASE[network];
    return base ? `${base}${raw.replace(/^@/, "")}` : null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
