/**
 * Reglas de "Archivos" subidos en la plataforma (tabla client_files).
 * Espejo de register_client_file() / delete_client_file() de la migración
 * 20261012002700_client_files: la BD vuelve a validar todo. Sin E/S: se usa
 * en el navegador, en el servidor y en scripts/check-archivos.mjs.
 */

/** Bucket privado donde viven (bajo `archivos/<client_id>/`). */
export const CLIENT_FILES_BUCKET = "onboarding";
export const MAX_CLIENT_FILE_BYTES = 200 * 1024 * 1024;
export const CLIENT_FILES_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
const NAME_MAX = 160;

export type UploaderKind = "agency" | "client";

/** MIME permitido → extensión con la que se guarda (la decide el servidor). */
export const CLIENT_FILE_TYPES: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** Extensión → MIME, para archivos que el navegador entrega sin tipo (p. ej. .heic, .csv). */
const EXT_TYPES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(CLIENT_FILE_TYPES).map(([mime, ext]) => [ext, mime])),
  jpeg: "image/jpeg",
  m4v: "video/mp4",
};

export const CLIENT_FILE_ACCEPT = [
  ...Object.keys(CLIENT_FILE_TYPES),
  ...Object.keys(EXT_TYPES).map((ext) => `.${ext}`),
].join(",");

export const CLIENT_FILE_ERRORS = {
  badType: "Formato no permitido: sube imágenes, videos, PDF o documentos de Office.",
  empty: "El archivo está vacío.",
  tooBig: "El archivo pesa más de 200 MB.",
  quota: "Se alcanzó el espacio de 5 GB de este cliente. Elimina archivos para subir más.",
  noUpload: "No tienes permiso para subir archivos a este cliente.",
  noDelete: "Solo puedes eliminar archivos que subiste tú.",
  missing: "No encontramos el archivo subido. Intenta de nuevo.",
  generic: "No pudimos subir el archivo. Intenta de nuevo.",
} as const;

/** MIME efectivo: el del navegador si es válido, si no por la extensión del nombre. */
export function clientFileMime(name: string, browserType: string): string | null {
  const type = browserType.toLowerCase();
  if (type in CLIENT_FILE_TYPES) return type;
  const ext = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
  return (ext && EXT_TYPES[ext]) || null;
}

/** Error de validación local (null = válido). */
export function clientFileProblem(mime: string | null, size: number): string | null {
  if (!mime || !(mime in CLIENT_FILE_TYPES)) return CLIENT_FILE_ERRORS.badType;
  if (!Number.isFinite(size) || size <= 0) return CLIENT_FILE_ERRORS.empty;
  if (size > MAX_CLIENT_FILE_BYTES) return CLIENT_FILE_ERRORS.tooBig;
  return null;
}

/** ¿Cabe `size` en la cuota del cliente? */
export function fitsQuota(used: number, size: number): boolean {
  return used + size <= CLIENT_FILES_QUOTA_BYTES;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Path de un archivo nuevo: `archivos/<client_id>/<uuid>.<ext>` (nunca el nombre del usuario). */
export function clientFilePath(clientId: string, fileId: string, mime: string): string {
  return `archivos/${clientId}/${fileId}.${CLIENT_FILE_TYPES[mime] ?? "bin"}`;
}

/** ¿El path es de ESTE cliente y tiene la forma exacta? (mismo patrón que el CHECK de la BD) */
export function isClientFilesPath(clientId: string, path: string): boolean {
  if (!new RegExp(`^${UUID}$`).test(clientId)) return false;
  return new RegExp(`^archivos/${clientId}/${UUID}\\.[a-z0-9]{2,5}$`).test(path);
}

/** Nombre visible: sin rutas, sin caracteres de control y acotado. */
export function cleanFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (base || "archivo").slice(0, NAME_MAX);
}

/**
 * Quién puede eliminar: la agencia (editor) solo lo que subió la agencia; el
 * usuario cliente solo lo que subió el cliente. Espejo de delete_client_file().
 */
export function canDeleteClientFile(
  actor: UploaderKind | null,
  uploaderKind: UploaderKind,
): boolean {
  return actor !== null && actor === uploaderKind;
}

/** Mensaje para un motivo de rechazo de register_client_file(). */
export function registerProblem(reason: string | undefined): string {
  switch (reason) {
    case "quota":
      return CLIENT_FILE_ERRORS.quota;
    case "too_big":
      return CLIENT_FILE_ERRORS.tooBig;
    case "bad_type":
      return CLIENT_FILE_ERRORS.badType;
    case "missing":
      return CLIENT_FILE_ERRORS.missing;
    default:
      return CLIENT_FILE_ERRORS.generic;
  }
}

/** "1,2 GB", "350 MB", "12 KB". */
export function formatBytes(bytes: number): string {
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;
  const fmt = (n: number, digits: number) =>
    n.toLocaleString("es-CL", { maximumFractionDigits: digits });
  if (bytes >= GB) return `${fmt(bytes / GB, 1)} GB`;
  if (bytes >= MB) return `${fmt(bytes / MB, bytes >= 100 * MB ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
