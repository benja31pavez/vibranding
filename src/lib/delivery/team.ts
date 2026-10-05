/**
 * Equipo de VIBRANDING que aparece como responsable de cada etapa del plan.
 *
 * Fotos: mientras `avatarUrl` sea null se muestran las iniciales.
 * TODO(fotos del equipo): subir las fotos a
 *   public/images/team/antonia.webp
 *   public/images/team/benjamin.webp
 * (cuadradas, ~256×256) y cambiar `avatarUrl` a "/images/team/antonia.webp" y
 * "/images/team/benjamin.webp".
 */

export type TeamMemberKey = "antonia" | "benjamin";

export interface TeamMember {
  readonly key: TeamMemberKey;
  readonly name: string;
  readonly role: string;
  /** Ruta pública de la foto (p. ej. "/images/team/antonia.webp"); null = iniciales. */
  readonly avatarUrl: string | null;
}

export const TEAM: Readonly<Record<TeamMemberKey, TeamMember>> = {
  antonia: { key: "antonia", name: "Antonia", role: "Diseñadora", avatarUrl: null },
  benjamin: { key: "benjamin", name: "Benjamín", role: "Publicista estratega", avatarUrl: null },
};

export const TEAM_ORDER: readonly TeamMemberKey[] = ["antonia", "benjamin"];

/** "Benjamín" → "B"; "Ana María" → "AM". */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
