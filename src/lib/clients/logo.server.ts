// Server-only: logo del cliente. Lo obtiene de la foto de perfil de Instagram
// (API oficial: cuenta propia conectada o Business Discovery), lo DESCARGA
// (la URL de Meta expira) y lo guarda en client-media/logos/<client_id>/.
// También guarda logos subidos a mano. Escribe con service_role.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  findOrgViewerAccount,
  graphGet,
  GraphError,
  loadClientContext,
} from "@/lib/instagram/engagement.server";
import { isDiscoveryNotMeasurable } from "@/lib/instagram/engagement";
import {
  LOGO_BUCKET,
  LOGO_DOWNLOAD_TIMEOUT_MS,
  LOGO_ERRORS,
  LOGO_MAX_BYTES,
  canUseInstagramLogo,
  exceedsDeclaredLength,
  isAllowedPictureUrl,
  isLogoSource,
  logoPath,
  validateLogoBytes,
  type InstagramLogoTrigger,
  type LogoSource,
} from "@/lib/clients/logo";

export type LogoResult =
  | { status: "updated"; logoUrl: string; source: LogoSource }
  /** No se pudo (cuenta personal, sin @, manual protegido…): motivo legible. */
  | { status: "skipped"; reason: string };

type LogoRow = {
  id: string;
  logo_url: string | null;
  logo_source: LogoSource | null;
  logo_updated_at: string | null;
};

/** Error esperable con mensaje para el usuario (no es una falla del servidor). */
class LogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogoError";
  }
}

function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

async function readLogoRow(clientId: string): Promise<LogoRow> {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id,logo_url,logo_source,logo_updated_at")
    .eq("id", clientId)
    .maybeSingle();
  if (isMissingColumn(error)) throw new LogoError(LOGO_ERRORS.missingColumns);
  if (error) {
    console.error("[client-logo] read failed", clientId, error.message);
    throw new Error("No se pudo leer el logo del cliente");
  }
  if (!data) throw new LogoError("No se encontró el cliente");
  const row = data as LogoRow;
  return { ...row, logo_source: isLogoSource(row.logo_source) ? row.logo_source : null };
}

/** URL de la foto de perfil según la API oficial, o LogoError con el motivo. */
async function fetchProfilePictureUrl(clientId: string): Promise<string> {
  const ctx = await loadClientContext(clientId);
  let picture: unknown;
  try {
    if (ctx.own) {
      const me = await graphGet<any>(ctx.own.igAccountId, {
        access_token: ctx.own.token,
        fields: "username,profile_picture_url",
      });
      picture = me?.profile_picture_url;
    } else {
      if (!ctx.handle) throw new LogoError(LOGO_ERRORS.noHandle);
      const viewer = await findOrgViewerAccount(ctx.orgId);
      if (!viewer) throw new LogoError(LOGO_ERRORS.noViewer);
      const res = await graphGet<any>(viewer.igAccountId, {
        access_token: viewer.token,
        fields: `business_discovery.username(${ctx.handle}){username,profile_picture_url}`,
      });
      if (!res?.business_discovery) throw new LogoError(LOGO_ERRORS.notBusiness);
      picture = res.business_discovery.profile_picture_url;
    }
  } catch (e) {
    if (e instanceof LogoError) throw e;
    if (!ctx.own && e instanceof GraphError && isDiscoveryNotMeasurable(e.code, e.subcode)) {
      throw new LogoError(LOGO_ERRORS.notBusiness);
    }
    console.error("[client-logo] graph failed", clientId, e);
    throw new Error(e instanceof Error ? `Meta: ${e.message}` : "Meta no respondió");
  }
  if (typeof picture !== "string" || !picture) throw new LogoError(LOGO_ERRORS.noPicture);
  if (!isAllowedPictureUrl(picture)) throw new LogoError(LOGO_ERRORS.badHost);
  return picture;
}

/** Lee el cuerpo cortando apenas supera el límite (no confía en content-length). */
async function readCapped(res: Response): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LOGO_MAX_BYTES) {
      await reader.cancel();
      throw new LogoError(LOGO_ERRORS.tooBig);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

async function downloadPicture(url: string): Promise<{ bytes: Uint8Array; type: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGO_DOWNLOAD_TIMEOUT_MS);
  try {
    // redirect "error": el CDN entrega directo; un redirect podría salir de los hosts permitidos.
    const res = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!res.ok) throw new Error(`El CDN de Instagram respondió ${res.status}`);
    if (exceedsDeclaredLength(res.headers.get("content-length"))) {
      throw new LogoError(LOGO_ERRORS.tooBig);
    }
    return { bytes: await readCapped(res), type: res.headers.get("content-type") };
  } catch (e) {
    if (controller.signal.aborted) throw new LogoError(LOGO_ERRORS.timeout);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Borra los logos anteriores del cliente (deja solo `keepPath`). Nunca falla la operación. */
async function removeOldLogos(clientId: string, keepPath: string): Promise<void> {
  const folder = `logos/${clientId}`;
  const { data, error } = await supabaseAdmin.storage.from(LOGO_BUCKET).list(folder);
  if (error) {
    console.error("[client-logo] list old failed", clientId, error.message);
    return;
  }
  const old = (data ?? []).map((f) => `${folder}/${f.name}`).filter((p) => p !== keepPath);
  if (old.length === 0) return;
  const { error: rmError } = await supabaseAdmin.storage.from(LOGO_BUCKET).remove(old);
  if (rmError) console.error("[client-logo] remove old failed", clientId, rmError.message);
}

/**
 * Valida, sube y registra el logo. Para Instagram la escritura es condicional
 * (si alguien subió uno manual entre medio, no se pisa salvo `reset`).
 */
async function storeLogo(
  clientId: string,
  bytes: Uint8Array,
  declaredType: string | null,
  source: LogoSource,
  trigger: InstagramLogoTrigger | null,
): Promise<LogoResult> {
  const check = validateLogoBytes(bytes, declaredType);
  if (!check.ok) throw new LogoError(check.error);

  const hash = (await sha256Hex(bytes)).slice(0, 24);
  const path = logoPath(clientId, hash, check.type);
  const { error: upError } = await supabaseAdmin.storage.from(LOGO_BUCKET).upload(path, bytes, {
    contentType: check.type,
    cacheControl: "31536000",
    upsert: true,
  });
  if (upError) {
    console.error("[client-logo] upload failed", clientId, upError.message);
    throw new Error("No se pudo guardar la imagen del logo");
  }
  const logoUrl = supabaseAdmin.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;

  let update = supabaseAdmin
    .from("clients")
    .update({ logo_url: logoUrl, logo_source: source, logo_updated_at: new Date().toISOString() })
    .eq("id", clientId);
  if (source === "instagram" && trigger !== "reset") {
    update = update.or("logo_source.is.null,logo_source.eq.instagram");
  }
  const { data, error } = await update.select("id");
  if (isMissingColumn(error)) throw new LogoError(LOGO_ERRORS.missingColumns);
  if (error) {
    console.error("[client-logo] update failed", clientId, error.message);
    throw new Error("No se pudo guardar el logo del cliente");
  }
  if (!data || data.length === 0) return { status: "skipped", reason: LOGO_ERRORS.manualLocked };

  await removeOldLogos(clientId, path);
  return { status: "updated", logoUrl, source };
}

/** Pide la foto de perfil a Instagram y la guarda como logo. Errores esperables → skipped. */
export async function refreshLogoFromInstagram(
  clientId: string,
  trigger: InstagramLogoTrigger,
): Promise<LogoResult> {
  try {
    const row = await readLogoRow(clientId);
    if (!canUseInstagramLogo(row.logo_source, trigger)) {
      return { status: "skipped", reason: LOGO_ERRORS.manualLocked };
    }
    const pictureUrl = await fetchProfilePictureUrl(clientId);
    const { bytes, type } = await downloadPicture(pictureUrl);
    return await storeLogo(clientId, bytes, type, "instagram", trigger);
  } catch (e) {
    if (e instanceof LogoError) return { status: "skipped", reason: e.message };
    throw e;
  }
}

/** Logo subido a mano (mismas validaciones). Queda protegido del cron. */
export async function saveManualLogo(
  clientId: string,
  bytes: Uint8Array,
  declaredType: string,
): Promise<LogoResult> {
  try {
    await readLogoRow(clientId);
    return await storeLogo(clientId, bytes, declaredType, "manual", null);
  } catch (e) {
    if (e instanceof LogoError) return { status: "skipped", reason: e.message };
    throw e;
  }
}
