/**
 * Lógica de servidor del onboarding público /onboarding/$token.
 *
 * - Lectura y envío usan la clave anon (sin sesión): get_onboarding_by_token y
 *   submit_onboarding están en GRANT EXECUTE para anon y son SECURITY DEFINER,
 *   así que no hace falta el service role (mínimo privilegio).
 * - El service role se usa SOLO para reserve_onboarding_upload (GRANT solo a
 *   service_role) y para firmar la subida en Storage (el bucket no tiene
 *   policies de INSERT). No se leen tablas directamente con service role.
 * Quien llama ya validó el input (zod) y los límites por IP/token.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  MAX_FILES,
  TOKEN_RE,
  mapDbError,
  safeFileName,
  type FieldError,
  type OnboardingPayload,
  type UploadRequestData,
} from "./schema";

const BUCKET = "onboarding";

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

// ------------------------------------------------------------------ subida

export type UploadUrlResult =
  { ok: true; path: string; uploadToken: string } | { ok: false; message: string };

const PREPARE_FAILED = "No pudimos preparar la subida. Intenta de nuevo en unos minutos.";

/** Mensajes para los rechazos de reserve_onboarding_upload(). */
const RESERVE_MESSAGES: Readonly<Record<string, string>> = {
  invalid: "Este link ya no es válido. Pide uno nuevo a tu contacto en Vibranding.",
  limit: `Ya recibimos ${MAX_FILES} archivos, el máximo. Si necesitas enviar más, escríbenos.`,
  rate: "Subiste muchos archivos en poco tiempo. Espera un rato y vuelve a intentarlo.",
  invalid_path: "El nombre del archivo no es válido. Renómbralo e intenta de nuevo.",
  duplicate: PREPARE_FAILED,
};

/**
 * Reserva el path en la BD (token vigente, cupo de 20 por token y 30/hora por
 * cliente, serializado con FOR UPDATE) y firma la subida a ese path exacto.
 * El navegador nunca elige el path: el sufijo lo arma el servidor.
 */
export async function createUploadUrl(req: UploadRequestData): Promise<UploadUrlResult> {
  const db = await admin();
  const suffix = `${crypto.randomUUID()}-${safeFileName(req.filename, req.contentType)}`;
  const { data, error } = await db.rpc("reserve_onboarding_upload", {
    _token: req.token,
    _path_suffix: suffix,
  });
  if (error) {
    console.error("[onboarding] reserve_onboarding_upload falló", error.code, error.message);
    return { ok: false, message: PREPARE_FAILED };
  }
  const res = data as { ok?: boolean; reason?: string; path?: string } | null;
  if (!res?.ok || typeof res.path !== "string") {
    if (res?.reason === "duplicate" || !res?.reason)
      console.error("[onboarding] reserva rechazada", res);
    return { ok: false, message: RESERVE_MESSAGES[res?.reason ?? ""] ?? PREPARE_FAILED };
  }

  // upsert: false → la URL firmada no puede sobrescribir un objeto existente.
  const { data: signed, error: signErr } = await db.storage
    .from(BUCKET)
    .createSignedUploadUrl(res.path, { upsert: false });
  if (signErr || !signed?.token) {
    console.error("[onboarding] no se pudo firmar la subida", signErr?.message);
    return { ok: false, message: PREPARE_FAILED };
  }
  return { ok: true, path: res.path, uploadToken: signed.token };
}

// ------------------------------------------------------------------ envío

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "invalid_payload"; error: FieldError }
  | { ok: false; reason: "error"; message: string };

const SUBMIT_FAILED = "No pudimos enviar el formulario. Intenta de nuevo en unos minutos.";

export async function submitOnboardingPayload(
  token: string,
  payload: OnboardingPayload,
): Promise<SubmitResult> {
  const { data, error } = await anonClient().rpc("submit_onboarding", {
    _token: token,
    _payload: payload,
  });
  if (error) {
    // 22023 se captura dentro de la función; por si alguna versión lo deja escapar:
    if (error.code === "22023")
      return { ok: false, reason: "invalid_payload", error: mapDbError(error.message) };
    console.error("[onboarding] submit_onboarding falló", error.code, error.message);
    return { ok: false, reason: "error", message: SUBMIT_FAILED };
  }
  const res = data as { ok?: boolean; reason?: string; error?: string } | null;
  if (res?.ok) return { ok: true };
  if (res?.reason === "invalid_payload")
    return { ok: false, reason: "invalid_payload", error: mapDbError(res.error) };
  if (res?.reason === "invalid") {
    return {
      ok: false,
      reason: "invalid",
      message: "Este link ya se usó o venció. Si necesitas cambiar algo, escríbenos.",
    };
  }
  console.error("[onboarding] respuesta inesperada de submit_onboarding", res);
  return { ok: false, reason: "error", message: SUBMIT_FAILED };
}
