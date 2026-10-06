/**
 * Lógica pura de "Archivos" del cliente: convierte entregables, publicaciones,
 * anuncios, reportes, archivos subidos en la plataforma y archivos del
 * onboarding en una lista común, y la filtra.
 * Sin E/S ni React.
 */
import type { StatusTone } from "@/components/app";
import type { Tables } from "@/integrations/supabase/types";
import type { StoredClientFile } from "@/lib/clientFiles/clientFiles.server";
import { monthName } from "@/lib/delivery/planCycle";
import { displayFileName } from "@/lib/onboarding/schema";
import { chileMonthOf, shortPeriod } from "../ficha/cliente/clientView";

/** Tipo de pieza, para el filtro y la etiqueta. */
export type FileKind = GalleryKind | "report" | "document";

/** Tipos de pieza gráfica. */
type GalleryKind = "post" | "carousel" | "story" | "reel" | "ad" | "brand" | "upload" | "other";

/** Cómo se muestra el archivo: imagen, video, PDF, página web o archivo genérico. */
export type FileMedia = "image" | "video" | "pdf" | "page" | "file";

export type FileStatus = "pending" | "changes" | "approved" | "published";

export interface ClientFile {
  id: string;
  name: string;
  /** Instante o fecha (ISO) que ordena y agrupa por mes. */
  date: string | null;
  kind: FileKind;
  media: FileMedia;
  /** Miniatura (imagen). Null: se dibuja el video o un ícono. */
  thumbUrl: string | null;
  /** Archivos que se ven en grande (varias láminas en un carrusel). */
  urls: string[];
  status: FileStatus | null;
  /** Archivo subido en "Archivos" (client_files): el único que se puede eliminar aquí. */
  stored?: { id: string; canDelete: boolean };
}

export const KIND_LABEL: Readonly<Record<FileKind, string>> = {
  post: "Post",
  carousel: "Carrusel",
  story: "Historia",
  reel: "Reel",
  ad: "Anuncio",
  brand: "Marca",
  upload: "Subido",
  other: "Otro",
  report: "Reporte",
  document: "Documento",
};

/** Orden de los filtros de la galería. */
export const GALLERY_KINDS: readonly FileKind[] = [
  "post",
  "carousel",
  "story",
  "reel",
  "ad",
  "brand",
  "upload",
  "other",
];

export const STATUS_META: Readonly<Record<FileStatus, { label: string; tone: StatusTone }>> = {
  pending: { label: "Por aprobar", tone: "warning" },
  changes: { label: "Con cambios", tone: "warning" },
  approved: { label: "Aprobado", tone: "info" },
  published: { label: "Publicado", tone: "success" },
};

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;
const NAME_CHARS = 60;

/** Tipo de medio por MIME y, si falta, por la extensión del nombre o la URL. */
export function mediaOf(mime: string | null, ...names: (string | null)[]): FileMedia {
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  const probe = names.filter(Boolean).join(" ");
  if (PDF_EXT.test(probe)) return "pdf";
  if (VIDEO_EXT.test(probe)) return "video";
  if (IMAGE_EXT.test(probe)) return "image";
  return "file";
}

function isVideoUrl(url: string): boolean {
  return VIDEO_EXT.test(url);
}

/** Primera línea del texto, acortada. */
function captionName(caption: string | null): string | null {
  const line = caption
    ?.split("\n")
    .find((l) => l.trim())
    ?.trim();
  if (!line) return null;
  return line.length > NAME_CHARS ? `${line.slice(0, NAME_CHARS)}…` : line;
}

export function isGallery(file: ClientFile): boolean {
  return file.media === "image" || file.media === "video";
}

// ── Entregables ──────────────────────────────────────────────────────────────

export type DeliverableFileRow = Pick<
  Tables<"deliverables">,
  | "id"
  | "title"
  | "type"
  | "status"
  | "file_url"
  | "file_name"
  | "mime_type"
  | "created_at"
  | "instagram_post_id"
>;

/** Tipo de pieza visual según el tipo de entregable. */
const DELIVERABLE_KIND: Readonly<Record<string, FileKind>> = {
  post: "post",
  reel: "reel",
  story: "story",
  design: "brand",
};

function deliverableStatus(status: string): FileStatus | null {
  if (status === "in_review") return "pending";
  if (status === "done") return "approved";
  return null;
}

/** Entregable con archivo → ClientFile (null si no tiene archivo). */
export function fromDeliverable(d: DeliverableFileRow): ClientFile | null {
  if (!d.file_url) return null;
  const media = mediaOf(d.mime_type, d.file_name, d.file_url);
  const visual = media === "image" || media === "video";
  const docKind: FileKind = d.type === "report" ? "report" : "document";
  const kind = visual ? (DELIVERABLE_KIND[d.type] ?? "other") : docKind;
  return {
    id: `deliverable-${d.id}`,
    name: d.title.trim() || (d.file_name ? displayFileName(d.file_name) : KIND_LABEL[kind]),
    date: d.created_at,
    kind,
    media,
    thumbUrl: media === "image" ? d.file_url : null,
    urls: [d.file_url],
    status: deliverableStatus(d.status),
  };
}

// ── Publicaciones de Instagram ───────────────────────────────────────────────

export type PostFileRow = Pick<
  Tables<"instagram_posts">,
  | "id"
  | "caption"
  | "format"
  | "type"
  | "image_url"
  | "cover_url"
  | "carousel_urls"
  | "published_at"
  | "scheduled_at"
  | "created_at"
  | "approval_status"
>;

function postStatus(p: PostFileRow): FileStatus | null {
  if (p.published_at) return "published";
  if (p.approval_status === "aprobado") return "approved";
  if (p.approval_status === "pendiente") return "pending";
  if (p.approval_status === "cambios") return "changes";
  return null;
}

/**
 * Publicación hecha por Vibranding → ClientFile. Solo las propuestas o las que
 * pasaron por aprobación: los posts importados de la cuenta no son nuestros.
 */
export function fromPost(p: PostFileRow): ClientFile | null {
  if (p.type !== "proposed" && !p.approval_status) return null;
  const slides = p.format === "carousel" ? p.carousel_urls.filter(Boolean) : [];
  const main = slides[0] ?? p.image_url ?? p.cover_url;
  if (!main) return null;
  const urls = slides.length > 0 ? slides : [p.image_url ?? p.cover_url ?? main];
  const video = isVideoUrl(urls[0]);
  const thumb = p.cover_url ?? (isVideoUrl(main) ? null : main);
  const kind: FileKind =
    p.format === "reel" ? "reel" : p.format === "carousel" ? "carousel" : "post";
  const date = p.published_at ?? p.scheduled_at ?? p.created_at;
  return {
    id: `post-${p.id}`,
    name: captionName(p.caption) ?? `${KIND_LABEL[kind]} sin texto`,
    date,
    kind,
    media: video ? "video" : "image",
    thumbUrl: thumb,
    urls,
    status: postStatus(p),
  };
}

// ── Anuncios ────────────────────────────────────────────────────────────────

export type AdFileRow = Pick<
  Tables<"meta_ads_ads">,
  "id" | "name" | "image_url" | "video_url" | "carousel_urls" | "status" | "created_at"
>;

/** Creatividad de un anuncio → ClientFile (null si no tiene imagen ni video). */
export function fromAd(a: AdFileRow): ClientFile | null {
  const slides = a.carousel_urls.filter(Boolean);
  const urls = a.video_url
    ? [a.video_url]
    : slides.length > 0
      ? slides
      : a.image_url
        ? [a.image_url]
        : [];
  if (urls.length === 0) return null;
  return {
    id: `ad-${a.id}`,
    name: a.name.trim() || "Anuncio",
    date: a.created_at,
    kind: "ad",
    media: a.video_url ? "video" : "image",
    thumbUrl: a.image_url ?? slides[0] ?? null,
    urls,
    status: a.status === "ACTIVE" ? "published" : null,
  };
}

// ── Reportes ────────────────────────────────────────────────────────────────

export interface ReportFileRow {
  id: string;
  period: string;
  token: string;
  sent_at: string | null;
}

/** Reporte enviado → ClientFile (página web en /r/<token>); null si no se ha enviado. */
export function fromReport(r: ReportFileRow, today: string): ClientFile | null {
  if (!r.sent_at) return null;
  return {
    id: `report-${r.id}`,
    name: `Reporte de ${shortPeriod(r.period, today)}`,
    date: r.sent_at,
    kind: "report",
    media: "page",
    thumbUrl: null,
    urls: [`/r/${encodeURIComponent(r.token)}`],
    status: null,
  };
}

// ── Subidos en "Archivos" (client_files, bucket privado, URL firmada) ────────

/** Archivo subido en la plataforma → ClientFile (null si no se pudo firmar su URL). */
export function fromStoredFile(f: StoredClientFile): ClientFile | null {
  if (!f.url) return null;
  const media = mediaOf(f.mime, f.name);
  return {
    id: `stored-${f.id}`,
    name: f.name,
    date: f.createdAt,
    kind: media === "image" || media === "video" ? "upload" : "document",
    media,
    thumbUrl: media === "image" ? f.url : null,
    urls: [f.url],
    status: null,
    stored: { id: f.id, canDelete: f.canDelete },
  };
}

/** Separa los subidos por la agencia (van con lo generado) de los del cliente. */
export function splitStored(files: readonly StoredClientFile[]): {
  agency: ClientFile[];
  client: ClientFile[];
} {
  const pick = (kind: StoredClientFile["uploaderKind"]) =>
    files.filter((f) => f.uploaderKind === kind).flatMap((f) => fromStoredFile(f) ?? []);
  return { agency: pick("agency"), client: pick("client") };
}

// ── Subidos por el cliente (onboarding, bucket privado) ──────────────────────

export interface UploadedFile {
  path: string;
  name: string;
  media: FileMedia;
  date: string | null;
}

export function fromOnboardingPath(path: string, submittedAt: string | null): UploadedFile {
  const name = displayFileName(path);
  return { path, name, media: mediaOf(null, name), date: submittedAt };
}

/** Fila de "Subidos por el cliente": onboarding o subido en la plataforma. */
export type ClientUpload =
  | { source: "onboarding"; key: string; date: string | null; file: UploadedFile }
  | { source: "archivos"; key: string; date: string | null; file: ClientFile };

/** Une lo subido en la plataforma y en el onboarding, del más nuevo al más antiguo. */
export function clientUploads(
  stored: readonly ClientFile[],
  onboarding: readonly UploadedFile[],
): ClientUpload[] {
  const fromStored = stored.map<ClientUpload>((file) => ({
    source: "archivos",
    key: file.id,
    date: file.date,
    file,
  }));
  const fromOnboarding = onboarding.map<ClientUpload>((file) => ({
    source: "onboarding",
    key: `onboarding-${file.path}`,
    date: file.date,
    file,
  }));
  return [...fromStored, ...fromOnboarding].sort(byDateDesc);
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export interface FileFilters {
  kind: FileKind | "all";
  /** "AAAA-MM" o "all". */
  month: string;
  query: string;
}

export const EMPTY_FILTERS: FileFilters = { kind: "all", month: "all", query: "" };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function matchesFilters(file: ClientFile, f: FileFilters): boolean {
  if (f.kind !== "all" && file.kind !== f.kind) return false;
  if (f.month !== "all" && chileMonthOf(file.date) !== f.month) return false;
  const q = normalize(f.query);
  return !q || normalize(file.name).includes(q);
}

/** Del más nuevo al más antiguo; sin fecha al final. */
export function byDateDesc(a: { date: string | null }, b: { date: string | null }): number {
  return (b.date ?? "").localeCompare(a.date ?? "");
}

/** Meses ("AAAA-MM") con archivos, del más reciente al más antiguo. */
export function monthsOf(files: readonly ClientFile[]): string[] {
  const months = new Set(files.flatMap((f) => chileMonthOf(f.date) ?? []));
  return [...months].sort((a, b) => b.localeCompare(a));
}

/** "2026-09" → "Septiembre 2026". */
export function monthOptionLabel(month: string): string {
  const name = monthName(month);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}

/** Tipos presentes en la galería, en el orden de los filtros. */
export function kindsOf(files: readonly ClientFile[]): FileKind[] {
  const present = new Set(files.map((f) => f.kind));
  return GALLERY_KINDS.filter((k) => present.has(k));
}

const STORAGE_PUBLIC = "/storage/v1/object/public/";
const STORAGE_SIGNED = "/storage/v1/object/sign/";

/**
 * Enlace de descarga. En el storage de Supabase (público o URL firmada)
 * `download=` fuerza la descarga con el nombre dado; en otros orígenes se abre
 * el archivo.
 */
export function downloadHref(url: string, name: string): string {
  if (!url.includes(STORAGE_PUBLIC) && !url.includes(STORAGE_SIGNED)) return url;
  const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1];
  const fileName =
    ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? `${name}.${ext}` : name;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(fileName)}`;
}
