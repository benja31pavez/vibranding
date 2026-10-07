/**
 * Tono de marca por categoría (como los íconos de "Lo que hacemos por ti" en el landing):
 * cada título cae siempre en el mismo de los tres colores del degradado. Las clases
 * `brand-tone-*` y `icon-chip` están en `identity.css`.
 */
const TONES = ["brand-tone-1", "brand-tone-2", "brand-tone-3"] as const;

export type BrandToneClass = (typeof TONES)[number];

export function brandTone(key: string): BrandToneClass {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}
