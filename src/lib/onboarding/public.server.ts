/**
 * Lógica de servidor del onboarding público /onboarding/$token.
 *
 * - Lectura y envío usan la clave anon (sin sesión): get_onboarding_by_token y
 *   submit_onboarding están en GRANT EXECUTE para anon y son SECURITY DEFINER,
 *   así que no hace falta el service role (mínimo privilegio).
 * - El service role se usa SOLO para Storage (contar objetos y firmar la
 *   subida, el bucket no tiene policies de INSERT) y para resolver client_id
 *   del token, que get_onboarding_by_token no expone.
 * Quien llama ya validó el input (zod) y los límites por IP/token.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MAX_FILES, TOKEN_RE, mapDbError, safeFileName, type FieldError, type OnboardingPayload, type UploadRequestData } from "./schema";

const BUCKET = "onboarding";
const OPEN_STATUSES = ["prospecto", "onboarding"];
/** Más que MAX_FILES para detectar que se llegó al tope aunque haya carpetas u otros objetos. */
const LIST_LIMIT = 100;

let anon: SupabaseClient<Database> | undefined;

function anonClient(): SupabaseClient<Database> {
  if (anon) return anon;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[onboarding] faltan SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");
    throw new Error("El formulario no está disponible en este momento. Intenta más tarde.");
  }
  anon = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return anon;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ------------------------------------------------------------------ lectura

export type OnboardingInfo =
  | { ok: false }
  | { ok: true; clientName: string; agencyName: string | null; expiresAt: string | null };

/** Token vigente y cliente en prospecto/onboarding → nombre y vigencia. Nada más. */
export async function loadOnboarding(token: string): Promise<OnboardingInfo> {
  if (!TOKEN_RE.test(token)) return { ok: false };
  const { data, error } = await anonClient().rpc("get_onboarding_by_token", { _token: token });
  if (error) {
    console.error("[onboarding] get_onboarding_by_token falló", error.message);
    throw new Error("No pudimos cargar el formulario. Intenta de nuevo en unos minutos.");
  }
  const res = data as { ok?: boolean; client?: Record<string, unknown> } | null;
  if (!res?.ok || !res.client) return { ok: false };
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    ok: true,
    clientName: str(res.client.name) ?? "tu negocio",
    agencyName: str(res.client.agency_name),
    expiresAt: str(res.client.expires_at),
  };
}

/** client_id de un token vigente (mismas condiciones que get_onboarding_by_token). */
async function resolveClientId(token: string): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null;
  const db = await admin();
  const { data: billing, error } = await db
    .from("client_billing")
    .select("client_id,onboarding_token_expires_at")
    .eq("onboarding_token", token)
    .maybeSingle();
  if (error) {
    console.error("[onboarding] no se pudo leer el token", error.message);
    throw new Error("No pudimos validar tu link. Intenta de nuevo en unos minutos.");
  }
  const expires = billing?.onboarding_token_expires_at;
  if (!billing || !expires || new Date(expires).getTime() <= Date.now()) return null;

  const { data: client, error: cErr } = await db.from("clients").select("status").eq("id", billing.client_id).maybeSingle();
  if (cErr) {
    console.error("[onboarding] no se pudo leer el cliente", cErr.message);
    throw new Error("No pudimos validar tu link. Intenta de nuevo en unos minutos.");
  }
  return client && OPEN_STATUSES.includes(client.status) ? billing.client_id : null;
}

// ------------------------------------------------------------------ subida

export type UploadUrlResult =
  | { ok: true; path: string; uploadToken: string }
  | { ok: false; message: string };

const INVALID_LINK = "Este link ya no es válido. Pide uno nuevo a tu contacto en Vibranding.";

/** Firma una subida a "<client_id>/<uuid>-<nombre seguro>" si el token sigue vigente y hay cupo. */
export async function createUploadUrl(req: UploadRequestData): Promise<UploadUrlResult> {
  const clientId = await resolveClientId(req.token);
  if (!clientId) return { ok: false, message: INVALID_LINK };

  const storage = (await admin()).storage.from(BUCKET);
  const { data: existing, error: listErr } = await storage.list(clientId, { limit: LIST_LIMIT });
  if (listErr) {
    console.error("[onboarding] no se pudo contar archivos", clientId, listErr.message);
    return { ok: false, message: "No pudimos preparar la subida. Intenta de nuevo en unos minutos." };
  }
  if ((existing?.length ?? 0) >= MAX_FILES) {
    return { ok: false, message: `Ya recibimos ${MAX_FILES} archivos, el máximo. Si necesitas enviar más, escríbenos.` };
  }

  const path = `${clientId}/${crypto.randomUUID()}-${safeFileName(req.filename, req.contentType)}`;
  const { data, error } = await storage.createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error("[onboarding] no se pudo firmar la subida", clientId, error?.message);
    return { ok: false, message: "No pudimos preparar la subida. Intenta de nuevo en unos minutos." };
  }
  return { ok: true, path: data.path ?? path, uploadToken: data.token };
}

// ------------------------------------------------------------------ envío

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "invalid_payload"; error: FieldError }
  | { ok: false; reason: "error"; message: string };

const SUBMIT_FAILED = "No pudimos enviar el formulario. Intenta de nuevo en unos minutos.";

export async function submitOnboardingPayload(token: string, payload: OnboardingPayload): Promise<SubmitResult> {
  const { data, error } = await anonClient().rpc("submit_onboarding", { _token: token, _payload: payload });
  if (error) {
    // 22023 se captura dentro de la función; por si alguna versión lo deja escapar:
    if (error.code === "22023") return { ok: false, reason: "invalid_payload", error: mapDbError(error.message) };
    console.error("[onboarding] submit_onboarding falló", error.code, error.message);
    return { ok: false, reason: "error", message: SUBMIT_FAILED };
  }
  const res = data as { ok?: boolean; reason?: string; error?: string } | null;
  if (res?.ok) return { ok: true };
  if (res?.reason === "invalid_payload") return { ok: false, reason: "invalid_payload", error: mapDbError(res.error) };
  if (res?.reason === "invalid") {
    return { ok: false, reason: "invalid", message: "Este link ya se usó o venció. Si necesitas cambiar algo, escríbenos." };
  }
  console.error("[onboarding] respuesta inesperada de submit_onboarding", res);
  return { ok: false, reason: "error", message: SUBMIT_FAILED };
}
