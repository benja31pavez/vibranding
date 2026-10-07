/**
 * Descripción que vale la pena mostrar: "www", "https://" o un par de signos
 * sueltos (restos de un campo a medio llenar) no se publican.
 */
export function meaningfulBio(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const letters = text.replace(/https?:\/\/|www\.?/gi, "").replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length >= 3 ? text : null;
}
