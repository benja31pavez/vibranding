/**
 * Lógica pura de la bandeja de aprobaciones (vista `approval_queue`).
 * Sin dependencias de React ni Supabase para poder reutilizarla y probarla.
 */

export const APPROVAL_KINDS = ["entregable", "post_instagram", "propuesta"] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_KIND_LABEL: Readonly<Record<ApprovalKind, string>> = {
  entregable: "Entregable en revisión",
  post_instagram: "Post de Instagram",
  propuesta: "Propuesta en borrador",
};

export const APPROVAL_KIND_LABEL_PLURAL: Readonly<Record<ApprovalKind, string>> = {
  entregable: "Entregables en revisión",
  post_instagram: "Posts de Instagram",
  propuesta: "Propuestas en borrador",
};

/** Decisiones posibles sobre un post de Instagram (CHECK de instagram_posts.approval_status). */
export type InstagramDecision = "aprobado" | "cambios" | "rechazado";

export interface ApprovalItem {
  kind: ApprovalKind;
  refId: string;
  clientId: string | null;
  clientName: string;
  title: string;
  createdAt: string | null;
  urlHint: string | null;
}

/** Fila cruda de la vista (todas las columnas de una vista son nullable en los tipos generados). */
export interface ApprovalQueueRow {
  client_id: string | null;
  created_at: string | null;
  kind: string | null;
  org_id: string | null;
  ref_id: string | null;
  title: string | null;
  url_hint: string | null;
}

export const UNKNOWN_CLIENT = "Sin cliente";

export function isApprovalKind(value: string | null | undefined): value is ApprovalKind {
  return APPROVAL_KINDS.includes(value as ApprovalKind);
}

/** Normaliza filas de la vista: descarta tipos desconocidos o sin ref_id y ordena de más antiguo a más nuevo. */
export function toApprovalItems(
  rows: readonly ApprovalQueueRow[],
  clientNames: ReadonlyMap<string, string>,
): ApprovalItem[] {
  return rows
    .flatMap((row): ApprovalItem[] => {
      if (!row.ref_id || !isApprovalKind(row.kind)) return [];
      return [
        {
          kind: row.kind,
          refId: row.ref_id,
          clientId: row.client_id,
          clientName: (row.client_id && clientNames.get(row.client_id)) || UNKNOWN_CLIENT,
          title: row.title?.trim() || APPROVAL_KIND_LABEL[row.kind],
          createdAt: row.created_at,
          urlHint: row.url_hint,
        },
      ];
    })
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

export const itemKey = (item: Pick<ApprovalItem, "kind" | "refId">) => `${item.kind}:${item.refId}`;

export interface ApprovalFilters {
  kind: ApprovalKind | "all";
  clientId: string | "all";
}

export function filterApprovals(
  items: readonly ApprovalItem[],
  filters: ApprovalFilters,
): ApprovalItem[] {
  return items.filter(
    (item) =>
      (filters.kind === "all" || item.kind === filters.kind) &&
      (filters.clientId === "all" || item.clientId === filters.clientId),
  );
}

export type GroupBy = "client" | "kind";

export interface ApprovalGroup {
  key: string;
  label: string;
  items: ApprovalItem[];
}

/** Agrupa por cliente (alfabético) o por tipo (orden de APPROVAL_KINDS). */
export function groupApprovals(items: readonly ApprovalItem[], groupBy: GroupBy): ApprovalGroup[] {
  const groups = new Map<string, ApprovalGroup>();
  for (const item of items) {
    const key = groupBy === "client" ? (item.clientId ?? "none") : item.kind;
    const label = groupBy === "client" ? item.clientName : APPROVAL_KIND_LABEL_PLURAL[item.kind];
    const existing = groups.get(key);
    groups.set(key, { key, label, items: [...(existing?.items ?? []), item] });
  }
  const list = [...groups.values()];
  if (groupBy === "kind") {
    return list.sort(
      (a, b) =>
        APPROVAL_KINDS.indexOf(a.key as ApprovalKind) -
        APPROVAL_KINDS.indexOf(b.key as ApprovalKind),
    );
  }
  return list.sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Clientes presentes en la cola, para el filtro. */
export function clientOptions(items: readonly ApprovalItem[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    if (item.clientId && !seen.has(item.clientId)) seen.set(item.clientId, item.clientName);
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export const PERMISSION_DENIED_MESSAGE = "No tienes permisos para esta acción";

/** El UPDATE no afectó filas aunque el ítem sigue pendiente: RLS no lo permite. */
export class ApprovalPermissionError extends Error {
  constructor() {
    super(PERMISSION_DENIED_MESSAGE);
    this.name = "ApprovalPermissionError";
  }
}

export const STALE_ITEM_MESSAGE = "Este ítem ya fue actualizado";

/** El UPDATE no afectó filas porque el ítem ya no está pendiente (otro usuario lo resolvió o se borró). */
export class ApprovalStaleError extends Error {
  constructor() {
    super(STALE_ITEM_MESSAGE);
    this.name = "ApprovalStaleError";
  }
}

/** Repone un ítem en la cola (si no está) manteniendo el orden por fecha. */
export function restoreItem(items: readonly ApprovalItem[], item: ApprovalItem): ApprovalItem[] {
  if (items.some((i) => itemKey(i) === itemKey(item))) return [...items];
  return [...items, item].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}
