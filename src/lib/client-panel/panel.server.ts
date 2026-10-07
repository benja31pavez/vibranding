/**
 * Lecturas del panel del cliente (/mi) — Plan, Archivos y Legal (solo servidor).
 *
 * Quién es el cliente lo decide la BD: las RPC client_* fijan el cliente con
 * user_client_id() (usuario cliente) o aceptan `_preview` solo para la agencia
 * dueña (owns_client). Aquí, antes de llamar con `_preview`, se vuelve a
 * exigir rol en la org del cliente (getClientOrgRole): la vista previa nunca
 * se acepta por "la fila es visible".
 *
 * Las RPC se llaman con la SESIÓN del usuario (no service_role). service_role
 * solo firma URLs de Storage cuyas rutas pertenecen al cliente que devolvió
 * la RPC.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fromAd,
  fromDeliverable,
  fromPost,
  fromReport,
  mediaOf,
  type AdFileRow,
  type ClientFile,
  type DeliverableFileRow,
  type PostFileRow,
  type ReportFileRow,
} from "@/components/clients/archivos/archivosModel";
import { CLIENT_FILES_BUCKET, isClientFilesPath } from "@/lib/clientFiles/clientFiles";
import { chileToday } from "@/lib/dates/chile";
import {
  clientMediaPath,
  isStorageUrl,
  type PanelContract,
  type PanelFile,
  type PanelFiles,
  type PanelPlan,
  type PanelResult,
} from "./model";

/** Las RPC de la Fase 2 aún no están en los tipos generados. */
type Db = SupabaseClient;

const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const CLIENT_MEDIA_BUCKET = "client-media";
/** PostgREST / Postgres: función aún no creada (migración sin aplicar). */
export const MISSING_FN_CODES = new Set(["PGRST202", "42883"]);

export const PREVIEW_DENIED =
  "No tienes acceso a la vista previa de este cliente. Pídele acceso a un administrador de tu equipo.";
const ACCESS_FAILED = "No pudimos verificar tu acceso. Intenta de nuevo en un momento.";

export class PanelPreviewDenied extends Error {
  constructor() {
    super(PREVIEW_DENIED);
    this.name = "PanelPreviewDenied";
  }
}

/** Vista previa: el usuario debe tener rol en la org dueña de ESE cliente. */
export async function assertPreviewAccess(userId: string, preview: string): Promise<void> {
  const { getClientOrgRole } = await import("@/lib/auth/clientAccess.server");
  let role: Awaited<ReturnType<typeof getClientOrgRole>>;
  try {
    role = await getClientOrgRole(userId, preview);
  } catch (e) {
    console.error("[client-panel] verificación de vista previa falló", {
      userId,
      preview,
      error: e instanceof Error ? e.message : e,
    });
    throw new Error(ACCESS_FAILED);
  }
  if (!role) throw new PanelPreviewDenied();
}

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/** Marca del cliente para la vista previa (mismas columnas que client_self). */
export async function loadPreviewBrand(userId: string, preview: string) {
  await assertPreviewAccess(userId, preview);
  const db = await adminDb();
  const { data, error } = await db
    .from("clients")
    .select("id,name,instagram_handle,logo_url")
    .eq("id", preview)
    .maybeSingle();
  if (error) {
    console.error("[client-panel] no se pudo leer la marca (vista previa)", error.message);
    throw new Error("No pudimos cargar la marca del cliente.");
  }
  if (!data) throw new PanelPreviewDenied();
  const row = data as {
    id: string;
    name: string | null;
    instagram_handle: string | null;
    logo_url: string | null;
  };
  return {
    id: row.id,
    name: row.name ?? "Cliente",
    instagramHandle: row.instagram_handle,
    logoUrl: row.logo_url,
  };
}

/**
 * Llama una RPC client_* con la sesión del usuario. `undefined` = la función
 * no existe (migración sin aplicar); `null` = sin cliente legible.
 */
async function callPanelRpc<T>(
  db: Db,
  userId: string,
  fn: "client_plan_board" | "client_files_catalog" | "client_contracts_list",
  preview: string | undefined,
): Promise<T | null | undefined> {
  if (preview) await assertPreviewAccess(userId, preview);
  const { data, error } = await db.rpc(fn, preview ? { _preview: preview } : {});
  if (error) {
    if (MISSING_FN_CODES.has(error.code ?? "")) return undefined;
    console.error(`[client-panel] ${fn} falló`, { userId, preview, code: error.code });
    throw new Error("No pudimos cargar esta sección. Intenta de nuevo en un momento.");
  }
  return (data ?? null) as T | null;
}

function toResult<T, R>(raw: T | null | undefined, map: (v: T) => R): PanelResult<R> {
  if (raw === undefined) return { status: "unavailable" };
  if (raw === null) return { status: "no_client" };
  return { status: "ok", data: map(raw) };
}

// ── Plan ────────────────────────────────────────────────────────────────────

interface RawPlan {
  plan_key: string | null;
  addons: string[] | null;
  stages: PanelPlan["stages"] | null;
  tasks: PanelPlan["tasks"] | null;
  objectives: PanelPlan["objectives"] | null;
}

export async function loadPanelPlan(
  db: Db,
  userId: string,
  preview: string | undefined,
): Promise<PanelResult<PanelPlan>> {
  const raw = await callPanelRpc<RawPlan>(db, userId, "client_plan_board", preview);
  return toResult(raw, (r) => ({
    planKey: r.plan_key ?? null,
    addons: (r.addons ?? []).filter((a): a is string => typeof a === "string"),
    stages: r.stages ?? [],
    tasks: r.tasks ?? [],
    objectives: (r.objectives ?? []).map((o) => ({
      ...o,
      target_value: o.target_value == null ? null : Number(o.target_value),
      current_value: o.current_value == null ? null : Number(o.current_value),
    })),
  }));
}

// ── Archivos ────────────────────────────────────────────────────────────────

interface RawStoredFile {
  id: string;
  path: string;
  name: string;
  size: number;
  mime: string;
  uploader_kind: "agency" | "client";
  created_at: string;
}

interface RawCatalog {
  client_id: string;
  deliverables: DeliverableFileRow[] | null;
  posts: PostFileRow[] | null;
  ads: AdFileRow[] | null;
  reports: ReportFileRow[] | null;
  files: RawStoredFile[] | null;
}

export async function signPaths(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();
  const db = await adminDb();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("[client-panel] no se pudieron firmar URLs", bucket, error.message);
    return new Map();
  }
  return new Map(
    (data ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])),
  );
}

/**
 * URL para el navegador: las de `client-media` se firman si su ruta es de
 * ESTE cliente; cualquier otra URL de Storage se descarta; las externas
 * (p. ej. el CDN de Instagram) se dejan como están.
 */
export function makeResolver(client: string, signed: Map<string, string>) {
  return (url: string | null | undefined): string | null => {
    if (!url) return null;
    const path = clientMediaPath(url, client);
    if (path) return signed.get(path) ?? null;
    return isStorageUrl(url) ? null : url;
  };
}

function rowUrls(catalog: RawCatalog): string[] {
  return [
    ...(catalog.deliverables ?? []).map((d) => d.file_url),
    ...(catalog.posts ?? []).flatMap((p) => [p.image_url, p.cover_url, ...(p.carousel_urls ?? [])]),
    ...(catalog.ads ?? []).flatMap((a) => [a.image_url, a.video_url, ...(a.carousel_urls ?? [])]),
  ].filter((u): u is string => Boolean(u));
}

const toPanelFile = (f: ClientFile): PanelFile => ({
  id: f.id,
  name: f.name,
  date: f.date,
  kind: f.kind,
  media: f.media,
  thumbUrl: f.thumbUrl,
  urls: f.urls,
  status: f.status,
});

const byDateDesc = (a: PanelFile, b: PanelFile) => (b.date ?? "").localeCompare(a.date ?? "");

function storedToPanel(f: RawStoredFile, url: string | null): PanelFile | null {
  if (!url) return null;
  const media = mediaOf(f.mime, f.name);
  return {
    id: `stored-${f.id}`,
    name: f.name,
    date: f.created_at,
    kind: media === "image" || media === "video" ? "upload" : "document",
    media,
    thumbUrl: media === "image" ? url : null,
    urls: [url],
    status: null,
  };
}

export function buildPanelFiles(
  catalog: RawCatalog,
  signedMedia: Map<string, string>,
  signedStored: Map<string, string>,
  today: string,
): PanelFiles {
  const client = catalog.client_id;
  const resolve = makeResolver(client, signedMedia);
  const keep = (url: string | null | undefined) => resolve(url);

  const posts = (catalog.posts ?? []).map((p) => ({
    ...p,
    image_url: keep(p.image_url),
    cover_url: keep(p.cover_url),
    carousel_urls: (p.carousel_urls ?? []).flatMap((u) => keep(u) ?? []),
  }));
  const postFiles = posts.flatMap((p) => fromPost(p) ?? []);
  const postIds = new Set(postFiles.map((f) => f.id.replace(/^post-/, "")));
  const deliverableFiles = (catalog.deliverables ?? [])
    .filter((d) => !d.instagram_post_id || !postIds.has(d.instagram_post_id))
    .map((d) => ({ ...d, file_url: keep(d.file_url) }))
    .flatMap((d) => fromDeliverable(d) ?? []);
  const adFiles = (catalog.ads ?? [])
    .map((a) => ({
      ...a,
      image_url: keep(a.image_url),
      video_url: keep(a.video_url),
      carousel_urls: (a.carousel_urls ?? []).flatMap((u) => keep(u) ?? []),
    }))
    .flatMap((a) => fromAd(a) ?? []);
  const reportFiles = (catalog.reports ?? []).flatMap((r) => fromReport(r, today) ?? []);

  // Defensa en profundidad: solo rutas privadas con la forma de ESTE cliente.
  const stored = (catalog.files ?? []).filter((f) => isClientFilesPath(client, f.path));
  const storedOf = (kind: RawStoredFile["uploader_kind"]) =>
    stored
      .filter((f) => f.uploader_kind === kind)
      .flatMap((f) => storedToPanel(f, signedStored.get(f.path) ?? null) ?? []);

  const vibranding = [
    ...[...postFiles, ...deliverableFiles, ...adFiles].map(toPanelFile),
    ...storedOf("agency"),
  ];
  const isVisual = (f: PanelFile) => f.media === "image" || f.media === "video";
  return {
    generated: vibranding.filter(isVisual).sort(byDateDesc),
    documents: [...reportFiles.map(toPanelFile), ...vibranding.filter((f) => !isVisual(f))].sort(
      byDateDesc,
    ),
    mine: storedOf("client").sort(byDateDesc),
  };
}

export async function loadPanelFiles(
  db: Db,
  userId: string,
  preview: string | undefined,
): Promise<PanelResult<PanelFiles>> {
  const raw = await callPanelRpc<RawCatalog>(db, userId, "client_files_catalog", preview);
  if (raw === undefined) return { status: "unavailable" };
  if (raw === null || !raw.client_id) return { status: "no_client" };
  // En vista previa la RPC devuelve el cliente pedido; si no, algo no cuadra.
  if (preview && raw.client_id !== preview) throw new PanelPreviewDenied();

  const client = raw.client_id;
  const mediaPaths = rowUrls(raw).flatMap((u) => clientMediaPath(u, client) ?? []);
  const storedPaths = (raw.files ?? [])
    .map((f) => f.path)
    .filter((p) => isClientFilesPath(client, p));
  const [signedMedia, signedStored] = await Promise.all([
    signPaths(CLIENT_MEDIA_BUCKET, mediaPaths),
    signPaths(CLIENT_FILES_BUCKET, storedPaths),
  ]);
  return { status: "ok", data: buildPanelFiles(raw, signedMedia, signedStored, chileToday()) };
}

// ── Legal ───────────────────────────────────────────────────────────────────

export async function loadPanelContracts(
  db: Db,
  userId: string,
  preview: string | undefined,
): Promise<PanelResult<PanelContract[]>> {
  const raw = await callPanelRpc<PanelContract[]>(db, userId, "client_contracts_list", preview);
  return toResult(raw, (rows) =>
    rows
      .filter((c) => c.status === "sent" || c.status === "signed")
      .map((c) => ({
        ...c,
        total_one_time: Number(c.total_one_time) || 0,
        total_monthly: Number(c.total_monthly) || 0,
        services: Array.isArray(c.services) ? c.services : [],
        clauses: Array.isArray(c.clauses) ? c.clauses : [],
        client: c.client && typeof c.client === "object" ? c.client : {},
      })),
  );
}
