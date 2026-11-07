/**
 * Tipo de archivo a partir del nombre o la URL (sin React), para "Archivos"
 * de la agencia y del panel del cliente.
 */
import type { FileVisualMedia } from "./fileVisuals";

const EXT_RE = /\.([a-z0-9]{2,5})(?:[?#]|$)/i;

/** Extensión en mayúsculas ("PDF", "XLSX") a partir del nombre o, si falta, de la URL. */
export function fileExtension(name: string, url?: string | null): string | null {
  const fromName = EXT_RE.exec(name)?.[1];
  const fromUrl = url && !url.startsWith("data:") ? EXT_RE.exec(url)?.[1] : undefined;
  const ext = fromName ?? fromUrl;
  return ext ? ext.toUpperCase() : null;
}

/** Etiqueta corta del tipo: extensión o, en reportes, "WEB". */
export function fileTypeLabel(media: FileVisualMedia, name: string, url?: string | null) {
  if (media === "page") return "WEB";
  return fileExtension(name, url);
}
