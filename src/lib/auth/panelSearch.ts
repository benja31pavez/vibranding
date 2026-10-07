/**
 * Único parámetro de URL que acepta el panel del cliente (/mi): `preview`, el
 * UUID del cliente que la AGENCIA quiere ver "como cliente". Cualquier otro
 * parámetro se descarta. El valor no da acceso por sí solo: el layout lo usa
 * solo si el usuario es de agencia, y el servidor lo valida con
 * getClientOrgRole (y la BD con owns_client) antes de leer nada.
 * Sin E/S: se usa en la ruta y en scripts/check-aislamiento.mjs.
 */
export interface PanelSearch {
  preview?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePanelSearch(search: Record<string, unknown>): PanelSearch {
  const preview = search.preview;
  return typeof preview === "string" && UUID_RE.test(preview)
    ? { preview: preview.toLowerCase() }
    : {};
}
