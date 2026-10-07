/**
 * Tipos y reglas puras de las secciones del panel del cliente (/mi) que se
 * leen en la Fase 2: Plan, Archivos y Legal. Sin E/S: se usan en el servidor
 * (panel.server.ts) y en el navegador (src/components/client-panel).
 *
 * Todo lo que llega aquí sale de las RPC client_plan_board,
 * client_files_catalog y client_contracts_list (columnas mínimas, cliente fijo
 * por user_client_id() o vista previa validada de la agencia).
 */

/** Resultado de una lectura del panel. */
export type PanelResult<T> =
  | { status: "ok"; data: T }
  /** La migración de la Fase 2 aún no está aplicada. */
  | { status: "unavailable" }
  /** La cuenta no tiene un cliente legible (no debería pasar dentro de /mi). */
  | { status: "no_client" };

// ── Plan ────────────────────────────────────────────────────────────────────

export type PanelTaskStatus = "pending" | "in_progress" | "in_review" | "done";

export interface PanelStageRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  sort_order: number;
  stage_key: string | null;
}

export interface PanelTask {
  id: string;
  title: string;
  status: PanelTaskStatus;
  due_date: string | null;
  sort_order: number;
  stage_key: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  created_at: string;
  /**
   * Solo el marcador de plantilla (`[plantilla:…]` / `[plan-mes:…]`) para
   * deducir la etapa. Se pasa como "description" a planStages.
   */
  marker: string | null;
}

export interface PanelObjective {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  sort_order: number;
}

export interface PanelPlan {
  planKey: string | null;
  addons: string[];
  stages: PanelStageRow[];
  tasks: PanelTask[];
  objectives: PanelObjective[];
}

/** Avance de un objetivo (0–100) o null si no tiene meta numérica. */
export function objectiveProgress(o: Pick<PanelObjective, "target_value" | "current_value">) {
  const target = Number(o.target_value);
  const current = Number(o.current_value ?? 0);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current)) return null;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

// ── Archivos ────────────────────────────────────────────────────────────────

export type PanelFileKind =
  | "post"
  | "carousel"
  | "story"
  | "reel"
  | "ad"
  | "brand"
  | "upload"
  | "other"
  | "report"
  | "document";

export type PanelFileMedia = "image" | "video" | "pdf" | "page" | "file";

export type PanelFileStatus = "pending" | "changes" | "approved" | "published";

export interface PanelFile {
  id: string;
  name: string;
  /** Instante o fecha (ISO) que ordena la lista. */
  date: string | null;
  kind: PanelFileKind;
  media: PanelFileMedia;
  thumbUrl: string | null;
  /** URLs para ver (firmadas por el servidor, 1 hora) o la página del reporte. */
  urls: string[];
  status: PanelFileStatus | null;
}

export interface PanelFiles {
  /** Piezas gráficas (imagen o video) de Vibranding. */
  generated: PanelFile[];
  /** Reportes enviados y documentos de Vibranding (PDF, Office…). */
  documents: PanelFile[];
  /** Lo que subió el propio cliente en la plataforma. */
  mine: PanelFile[];
}

export const FILE_KIND_LABEL: Readonly<Record<PanelFileKind, string>> = {
  post: "Post",
  carousel: "Carrusel",
  story: "Historia",
  reel: "Reel",
  ad: "Anuncio",
  brand: "Marca",
  upload: "Archivo",
  other: "Pieza",
  report: "Reporte",
  document: "Documento",
};

export const FILE_STATUS_LABEL: Readonly<Record<PanelFileStatus, string>> = {
  pending: "Por aprobar",
  changes: "Con cambios",
  approved: "Aprobado",
  published: "Publicado",
};

const STORAGE_PUBLIC = "/storage/v1/object/public/";
const STORAGE_SIGNED = "/storage/v1/object/sign/";

/** Enlace de descarga: en Storage, `download=` fuerza la descarga con el nombre dado. */
export function fileDownloadHref(url: string, name: string): string {
  if (!url.includes(STORAGE_PUBLIC) && !url.includes(STORAGE_SIGNED)) return url;
  const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1];
  const fileName =
    ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? `${name}.${ext}` : name;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(fileName)}`;
}

/**
 * Ruta de un objeto del bucket público `client-media` a partir de su URL, solo
 * si pertenece a ESTE cliente (`<carpeta>/<client>/…`). Null si la URL no es
 * de ese bucket o es de otro cliente.
 */
export function clientMediaPath(url: string, client: string): string | null {
  const marker = `${STORAGE_PUBLIC}client-media/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const raw = url.slice(at + marker.length).split(/[?#]/)[0];
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const parts = path.split("/");
  if (parts.length < 3 || parts.some((p) => p === "" || p === "." || p === "..")) return null;
  return parts[1] === client ? path : null;
}

/** ¿Es una URL de Storage de Supabase (cualquier bucket)? */
export function isStorageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/");
}

// ── Legal ───────────────────────────────────────────────────────────────────

export type PanelContractStatus = "sent" | "signed";

export interface PanelContractLine {
  service_key: string;
  label: string;
  one_time_price: number;
  monthly_price: number;
  included_text: string | null;
  min_months?: number | null;
}

export interface PanelContract {
  id: string;
  title: string;
  status: PanelContractStatus;
  currency: string;
  payment_due_days: number;
  effective_date: string | null;
  signed_at: string | null;
  created_at: string;
  total_one_time: number;
  total_monthly: number;
  services: PanelContractLine[];
  clauses: { title: string; body: string }[];
  client: {
    name?: string;
    handle?: string;
    legal_name?: string;
    tax_id?: string;
    address?: string;
    email?: string;
  };
  agency: {
    name: string | null;
    legal_name: string | null;
    tax_id: string | null;
    address: string | null;
    email: string | null;
    jurisdiction: string | null;
    governing_law: string | null;
    vat_included: boolean | null;
    price_basis: string | null;
  };
}

export const CONTRACT_STATUS_LABEL: Readonly<Record<PanelContractStatus, string>> = {
  sent: "Por firmar",
  signed: "Firmado",
};

/** "Plan Crecimiento + 1 adicional" a partir de las líneas del contrato. */
export function contractServicesLabel(lines: readonly PanelContractLine[]): string {
  if (lines.length === 0) return "Sin servicios";
  const [first, ...rest] = lines;
  if (rest.length === 0) return first.label;
  return `${first.label} + ${rest.length} ${rest.length === 1 ? "adicional" : "adicionales"}`;
}

/** Nombre del PDF: "contrato-mi-marca.pdf". */
export function contractFileName(c: Pick<PanelContract, "client" | "title">): string {
  const base = (c.client.name ?? c.title ?? "contrato")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `contrato-${base || "cliente"}.pdf`;
}
