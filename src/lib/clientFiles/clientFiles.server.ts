/**
 * Servidor de "Archivos" subidos en la plataforma (tabla client_files).
 *
 * Autorización en dos capas:
 *  1. Aquí: el actor se resuelve contra el cliente pedido (rol en la org dueña
 *     vía getClientOrgRole, o fila en client_users de ESE cliente). Nunca se
 *     confía en un "tipo de usuario" que venga del navegador.
 *  2. En la BD: las RPC register_client_file / delete_client_file se llaman
 *     con la sesión del usuario (auth.uid()) y vuelven a decidir autoría y
 *     permisos; la lectura de client_files pasa por su RLS.
 * service_role solo firma URLs y borra objetos de Storage ya autorizados.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENT_EDITOR_ROLES,
  ClientAccessError,
  getClientOrgRole,
} from "@/lib/auth/clientAccess.server";
import {
  CLIENT_FILE_ERRORS,
  CLIENT_FILES_BUCKET,
  CLIENT_FILES_QUOTA_BYTES,
  canDeleteClientFile,
  cleanFileName,
  clientFilePath,
  clientFileProblem,
  fitsQuota,
  isClientFilesPath,
  registerProblem,
  type UploaderKind,
} from "./clientFiles";

/** Las URLs firmadas de la lista duran 1 hora (la query se refresca antes). */
const LIST_URL_TTL_SECONDS = 60 * 60;
const LIST_LIMIT = 500;
const NO_ACCESS = "No tienes acceso a este cliente";
/** PostgREST / Postgres: tabla o función aún no creadas (migración sin aplicar). */
const MISSING_CODES = new Set(["42P01", "PGRST205", "PGRST202", "42883"]);

// La tabla y las RPC aún no están en los tipos generados: cliente sin tipar.
type Db = SupabaseClient;

export interface ClientFileActor {
  /** Quién es el usuario frente a este cliente. */
  kind: UploaderKind;
  /** Puede subir (agencia: owner/admin/agent; cliente: siempre). */
  canUpload: boolean;
  /** Tipo de autor con el que sube y borra (null = solo lectura). */
  author: UploaderKind | null;
}

export interface StoredClientFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  uploaderKind: UploaderKind;
  createdAt: string;
  /** URL firmada de lectura (1 hora). Null si no se pudo firmar. */
  url: string | null;
  canDelete: boolean;
}

export interface ClientFilesList {
  /** false = la migración aún no está aplicada. */
  available: boolean;
  actor: ClientFileActor;
  usage: { used: number; limit: number };
  files: StoredClientFile[];
}

interface ClientFileRow {
  id: string;
  path: string;
  name: string;
  size: number;
  mime: string;
  uploader_kind: UploaderKind;
  created_at: string;
}

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

function isMissing(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_CODES.has(error.code));
}

/** Agencia (cualquier rol de la org dueña) o el usuario cliente de ESE cliente. */
export async function resolveActor(userId: string, clientId: string): Promise<ClientFileActor> {
  const role = await getClientOrgRole(userId, clientId);
  if (role) {
    const editor = CLIENT_EDITOR_ROLES.includes(role);
    return { kind: "agency", canUpload: editor, author: editor ? "agency" : null };
  }
  const db = await admin();
  const { data, error } = await db
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    console.error("[client-files] no se pudo verificar client_users", error.message);
    throw new Error("No pudimos verificar tu acceso. Intenta de nuevo.");
  }
  if (!data) throw new ClientAccessError(NO_ACCESS);
  return { kind: "client", canUpload: true, author: "client" };
}

async function assertCanUpload(userId: string, clientId: string): Promise<ClientFileActor> {
  const actor = await resolveActor(userId, clientId);
  if (!actor.canUpload) throw new ClientAccessError(CLIENT_FILE_ERRORS.noUpload);
  return actor;
}

async function usedBytes(db: Db, clientId: string): Promise<number | null> {
  const { data, error } = await db.rpc("client_files_usage", { _client_id: clientId });
  if (isMissing(error)) return null;
  if (error) {
    console.error("[client-files] client_files_usage falló", error.code, error.message);
    throw new Error("No pudimos revisar el espacio disponible. Intenta de nuevo.");
  }
  const used = Number((data as { used?: unknown } | null)?.used ?? 0);
  return Number.isFinite(used) ? used : 0;
}

async function signAll(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const db = await admin();
  const { data, error } = await db.storage
    .from(CLIENT_FILES_BUCKET)
    .createSignedUrls(paths, LIST_URL_TTL_SECONDS);
  if (error) {
    console.error("[client-files] no se pudieron firmar las URLs", error.message);
    return new Map();
  }
  return new Map(
    (data ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])),
  );
}

export async function listClientFiles(
  userId: string,
  userDb: Db,
  clientId: string,
): Promise<ClientFilesList> {
  const actor = await resolveActor(userId, clientId);
  const empty = { used: 0, limit: CLIENT_FILES_QUOTA_BYTES };

  // Con la sesión del usuario: la RLS de client_files decide qué filas ve.
  const { data, error } = await userDb
    .from("client_files")
    .select("id,path,name,size,mime,uploader_kind,created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (isMissing(error)) return { available: false, actor, usage: empty, files: [] };
  if (error) {
    console.error("[client-files] no se pudo leer client_files", clientId, error.message);
    throw new Error("No pudimos cargar los archivos. Intenta de nuevo.");
  }

  // Defensa en profundidad: solo paths con la forma de ESTE cliente.
  const rows = ((data ?? []) as ClientFileRow[]).filter((r) => isClientFilesPath(clientId, r.path));
  const [urls, used] = await Promise.all([
    signAll(rows.map((r) => r.path)),
    usedBytes(userDb, clientId),
  ]);
  return {
    available: true,
    actor,
    usage: { used: used ?? 0, limit: CLIENT_FILES_QUOTA_BYTES },
    files: rows.map((r) => ({
      id: r.id,
      name: r.name,
      size: Number(r.size),
      mime: r.mime,
      uploaderKind: r.uploader_kind,
      createdAt: r.created_at,
      url: urls.get(r.path) ?? null,
      canDelete: canDeleteClientFile(actor.author, r.uploader_kind),
    })),
  };
}

export async function createUploadSlot(
  userId: string,
  userDb: Db,
  input: { clientId: string; mime: string; size: number },
): Promise<{ path: string; token: string }> {
  await assertCanUpload(userId, input.clientId);
  const problem = clientFileProblem(input.mime, input.size);
  if (problem) throw new Error(problem);

  const used = await usedBytes(userDb, input.clientId);
  if (used === null) throw new Error("La subida de archivos aún no está habilitada.");
  if (!fitsQuota(used, input.size)) throw new Error(CLIENT_FILE_ERRORS.quota);

  const path = clientFilePath(input.clientId, crypto.randomUUID(), input.mime);
  const db = await admin();
  // upsert: false → la URL firmada no puede sobrescribir un objeto existente.
  const { data, error } = await db.storage
    .from(CLIENT_FILES_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.token) {
    console.error("[client-files] no se pudo firmar la subida", input.clientId, error?.message);
    throw new Error(CLIENT_FILE_ERRORS.generic);
  }
  return { path, token: data.token };
}

async function removeObject(path: string, why: string): Promise<void> {
  const db = await admin();
  const { error } = await db.storage.from(CLIENT_FILES_BUCKET).remove([path]);
  // Si falla, el objeto queda sin registro y la limpieza diaria lo borra.
  if (error) console.error(`[client-files] no se pudo borrar el objeto (${why})`, error.message);
}

export async function confirmUpload(
  userId: string,
  userDb: Db,
  input: { clientId: string; path: string; name: string },
): Promise<{ id: string }> {
  await assertCanUpload(userId, input.clientId);
  if (!isClientFilesPath(input.clientId, input.path)) throw new Error("Archivo no válido");

  // Con la sesión del usuario: la BD decide la autoría con auth.uid().
  const { data, error } = await userDb.rpc("register_client_file", {
    _client_id: input.clientId,
    _path: input.path,
    _name: cleanFileName(input.name),
  });
  if (error) {
    console.error("[client-files] register_client_file falló", error.code, error.message);
    if (error.code === "42501") throw new ClientAccessError(CLIENT_FILE_ERRORS.noUpload);
    throw new Error(CLIENT_FILE_ERRORS.generic);
  }
  const res = data as { ok?: boolean; reason?: string; id?: string } | null;
  if (!res?.ok || typeof res.id !== "string") {
    // Rechazado (cuota, tamaño, tipo): el objeto subido no se conserva.
    if (res?.reason !== "duplicate") await removeObject(input.path, res?.reason ?? "rechazo");
    throw new Error(registerProblem(res?.reason));
  }
  return { id: res.id };
}

export async function deleteFile(
  userId: string,
  userDb: Db,
  input: { clientId: string; fileId: string },
): Promise<void> {
  const actor = await resolveActor(userId, input.clientId);
  if (!actor.author) throw new ClientAccessError(CLIENT_FILE_ERRORS.noDelete);

  // La BD vuelve a verificar: agencia → solo 'agency'; cliente → solo 'client' de su cliente.
  const { data, error } = await userDb.rpc("delete_client_file", {
    _client_id: input.clientId,
    _id: input.fileId,
  });
  if (error) {
    if (error.code === "42501") throw new ClientAccessError(CLIENT_FILE_ERRORS.noDelete);
    console.error("[client-files] delete_client_file falló", error.code, error.message);
    throw new Error("No pudimos eliminar el archivo. Intenta de nuevo.");
  }
  const res = data as { client_id?: string; path?: string } | null;
  // El RPC filtra por client_id; aun así, solo se borra un path de ESTE cliente.
  if (
    res?.client_id === input.clientId &&
    res.path &&
    isClientFilesPath(input.clientId, res.path)
  ) {
    await removeObject(res.path, "eliminado");
  }
}
