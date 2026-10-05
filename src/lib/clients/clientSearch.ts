/**
 * Búsqueda de clientes del header: por marca (clients.name, client_intake.razon_social)
 * y por persona de contacto (client_intake.contacto_nombre). Sin dependencias, para
 * poder probarla con scripts/check-client-search.mjs.
 */

export interface ClientSearchEntry {
  id: string;
  /** Nombre de la marca o negocio (clients.name). */
  brand: string;
  /** Razón social de la ficha de onboarding, si existe. */
  legalName: string | null;
  /** Persona de contacto de la ficha de onboarding, si existe. */
  contactName: string | null;
  status: string;
}

/** Minúsculas, sin tildes ni diéresis, espacios colapsados. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function haystackOf(entry: ClientSearchEntry): string {
  return normalizeSearchText([entry.brand, entry.legalName, entry.contactName].join(" "));
}

/**
 * Filtra por todas las palabras de la búsqueda (en cualquier orden y campo).
 * Búsqueda vacía: devuelve la lista tal cual. Nunca muta la entrada.
 */
export function filterClients(
  entries: readonly ClientSearchEntry[],
  query: string,
): ClientSearchEntry[] {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return [...entries];
  return entries.filter((entry) => {
    const haystack = haystackOf(entry);
    return terms.every((term) => haystack.includes(term));
  });
}
