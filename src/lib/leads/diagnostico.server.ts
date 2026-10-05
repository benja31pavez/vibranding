/**
 * Alta automática de prospectos desde el formulario público /diagnostico.
 *
 * Destino: la org del administrador de la plataforma. Se resuelve así:
 *   1. PLATFORM_ADMIN_EMAILS (en orden) → primer usuario de Auth con ese correo
 *      CONFIRMADO;
 *   2. su org: org_members con role = 'owner' (la más antigua).
 * Si no se puede resolver (variable vacía, usuario inexistente o sin org), el
 * lead NO se guarda en otra tabla: se registra el error en el log del Worker
 * (tag [diagnostico][LEAD_PERDIDO]) y se intenta igual el aviso por correo a
 * PLATFORM_ADMIN_EMAILS. El visitante ve un aviso para escribir por WhatsApp.
 *
 * Consentimiento (Ley 21.719): un prospecto NUEVO solo queda creado si su
 * consentimiento quedó registrado; si el registro falla, se borra el prospecto
 * recién creado y el resultado es "error". Si el prospecto ya existía, se
 * intenta registrar el consentimiento igual y, si falla, solo se loguea.
 *
 * Marketing (opcional, independiente): si el visitante marcó la casilla de
 * novedades, se registra OTRA fila en prospect_consents (purpose = 'marketing')
 * y solo si quedó registrada se marca prospects.marketing_opt_in = true. Si
 * falla (p. ej. migración 20261012001900 sin aplicar), el lead se guarda igual
 * con marketing_opt_in = false (default) y se loguea. Un prospecto en 'baja'
 * cuenta siempre como sin permiso (ver acceptsMarketingEmail).
 *
 * Duplicados: prospects tiene índices únicos (org, email) y (org, nombre+comuna).
 * Se inserta y, si choca (23505), se busca el existente y se le agrega una nota
 * con append_prospect_note en vez de duplicarlo. No se cambia su estado
 * (un prospecto en 'baja' solo sale de 'baja' a mano).
 */
import { platformAdminEmails } from "@/lib/auth/platformAdmin.server";
import { DEFAULT_FROM, sendViaResend, toHtml } from "@/lib/bookings/notify.server";
import {
  CONSENT_TEXT,
  CONSENT_VERSION,
  DIAGNOSTICO_SOURCE,
  MARKETING_CONSENT_TEXT,
  MARKETING_CONSENT_VERSION,
  budgetLabel,
  buildInfoNoteLines,
  goalLabel,
  splitPresence,
  type DiagnosticoInput,
} from "./diagnostico.schema";
import { leadLostLine, safeSnippet, type SaveOutcome } from "./diagnostico.outcome";

export type { SaveOutcome } from "./diagnostico.outcome";

const ORG_CACHE_MS = 10 * 60 * 1000;
/** Si no se pudo resolver la org, no reintenta listUsers en cada envío. */
const ORG_NEGATIVE_CACHE_MS = 2 * 60 * 1000;
const SUBJECT_MAX = 120;
const USERS_PER_PAGE = 200;
const MAX_USER_PAGES = 25;
const UNIQUE_VIOLATION = "23505";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type Target = { orgId: string; ownerEmail: string };

/** Error de BD/Auth que solo expone el código (nunca mensajes que puedan traer datos). */
class DbError extends Error {
  constructor(
    readonly step: string,
    readonly code: string | undefined,
  ) {
    super(`${step}: ${code ?? "sin código"}`);
    this.name = "DbError";
  }
}

/** Log de error con solo paso + código. */
function logError(e: unknown): void {
  if (e instanceof DbError) console.error(`[diagnostico] ${e.step} falló (code ${e.code ?? "?"})`);
  else console.error(`[diagnostico] error inesperado (${(e as Error)?.name ?? "desconocido"})`);
}

let cachedTarget: { value: Target | null; at: number } | null = null;

async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Primer usuario confirmado cuyo correo está en la allowlist (respeta el orden de la variable). */
async function findPlatformAdminUser(admin: Admin): Promise<{ id: string; email: string } | null> {
  const allowed = [...platformAdminEmails()];
  if (allowed.length === 0) return null;
  const found = new Map<string, string>();
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) throw new DbError("listUsers", error.code ?? String(error.status ?? ""));
    for (const u of data.users) {
      const email = (u.email ?? "").trim().toLowerCase();
      if (email && u.email_confirmed_at && allowed.includes(email)) found.set(email, u.id);
    }
    if (found.has(allowed[0]!) || data.users.length < USERS_PER_PAGE) break;
  }
  const email = allowed.find((e) => found.has(e));
  return email ? { id: found.get(email)!, email } : null;
}

/** Org destino de los leads de la web, o null si no se puede resolver (ver cabecera). */
export async function resolveLeadsTarget(admin: Admin, now = Date.now()): Promise<Target | null> {
  if (cachedTarget) {
    const ttl = cachedTarget.value ? ORG_CACHE_MS : ORG_NEGATIVE_CACHE_MS;
    if (now - cachedTarget.at < ttl) return cachedTarget.value;
  }
  const user = await findPlatformAdminUser(admin);
  if (!user) {
    cachedTarget = { value: null, at: now };
    return null;
  }
  const { data, error } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new DbError("org_members", error.code);
  if (!data) {
    cachedTarget = { value: null, at: now };
    return null;
  }
  const value = { orgId: data.org_id, ownerEmail: user.email };
  cachedTarget = { value, at: now };
  return value;
}

function todayCl(): string {
  return new Date().toLocaleDateString("es-CL", { timeZone: "America/Santiago" });
}

/** Una línea (≤ 300 caracteres, límite de append_prospect_note) con lo que pidió el lead. */
export function buildLeadNote(input: DiagnosticoInput, unparsedPresence: string | null): string {
  const parts = [
    `Diagnóstico web ${todayCl()}`,
    `quiere: ${goalLabel(input.objetivo)}`,
    budgetLabel(input.presupuesto) ? `presupuesto: ${budgetLabel(input.presupuesto)}` : null,
    input.plan ? `plan de interés: ${input.plan}` : null,
    unparsedPresence ? `presencia: ${unparsedPresence}` : null,
    "aceptó ser contactado",
  ];
  return parts.filter(Boolean).join(" · ").slice(0, 300);
}

/** Escapa % _ \ para usar un valor literal en ilike. */
function likeLiteral(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function findExisting(
  admin: Admin,
  orgId: string,
  input: DiagnosticoInput,
): Promise<string | null> {
  const byEmail = await admin
    .from("prospects")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email_publico", likeLiteral(input.email))
    .limit(1)
    .maybeSingle();
  if (byEmail.error) throw new DbError("buscar duplicado por correo", byEmail.error.code);
  if (byEmail.data) return byEmail.data.id;
  const byName = await admin
    .from("prospects")
    .select("id")
    .eq("org_id", orgId)
    .ilike("nombre", likeLiteral(input.negocio))
    .ilike("comuna", likeLiteral(input.comuna))
    .limit(1)
    .maybeSingle();
  if (byName.error) throw new DbError("buscar duplicado por nombre", byName.error.code);
  return byName.data?.id ?? null;
}

/** Columnas de las tablas nuevas (aún no están en types.ts hasta aplicar la migración). */
type UntypedAdmin = {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>;
    update: (row: Record<string, unknown>) => {
      eq: (col: string, value: string) => PromiseLike<{ error: { code?: string } | null }>;
    };
  };
};

/** Tabla aún no creada (PostgREST PGRST205 / Postgres 42P01). */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(value).digest("hex");
}

/** Hash salado del correo (mismo formato que prospect_consents.email_hash). */
async function emailHash(input: DiagnosticoInput): Promise<string> {
  const salt = process.env["IP_HASH_SALT"]?.trim() ?? "";
  return sha256(`${input.email.trim().toLowerCase()}:${salt}`);
}

/**
 * Registra el consentimiento (Ley 21.719) en prospect_consents. Lanza DbError
 * si no queda registrado (incluido que falte la migración 20261012000200).
 */
async function recordConsent(
  admin: Admin,
  orgId: string,
  prospectId: string | null,
  input: DiagnosticoInput,
  ipHash: string | null,
): Promise<void> {
  const { error } = await (admin as unknown as UntypedAdmin).from("prospect_consents").insert({
    org_id: orgId,
    prospect_id: prospectId,
    email_hash: await emailHash(input),
    channel: "web_diagnostico",
    consent_text: CONSENT_TEXT,
    consent_version: CONSENT_VERSION,
    ip_hash: ipHash,
  });
  if (!error) return;
  if (MISSING_TABLE.has(error.code ?? "")) {
    console.error(
      "[diagnostico] prospect_consents no existe aún: aplica la migración 20261012000200",
    );
  }
  throw new DbError("insert prospect_consents", error.code);
}

/**
 * Consentimiento de marketing (opcional): su propia fila en prospect_consents y,
 * si quedó registrada, prospects.marketing_opt_in = true. Nunca lanza ni bloquea
 * el lead: si algo falla, marketing_opt_in queda en false (default) y se loguea.
 */
async function recordMarketingConsent(
  admin: Admin,
  orgId: string,
  prospectId: string | null,
  input: DiagnosticoInput,
  ipHash: string | null,
): Promise<void> {
  if (!input.marketing) return;
  try {
    const untyped = admin as unknown as UntypedAdmin;
    const { error } = await untyped.from("prospect_consents").insert({
      org_id: orgId,
      prospect_id: prospectId,
      email_hash: await emailHash(input),
      channel: "web_diagnostico",
      purpose: "marketing",
      consent_text: MARKETING_CONSENT_TEXT,
      consent_version: MARKETING_CONSENT_VERSION,
      ip_hash: ipHash,
    });
    if (error) throw new DbError("insert prospect_consents (marketing)", error.code);
    if (!prospectId) return;
    const { error: optError } = await untyped
      .from("prospects")
      .update({ marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() })
      .eq("id", prospectId);
    if (optError) throw new DbError("update prospects.marketing_opt_in", optError.code);
  } catch (e) {
    console.error(
      "[diagnostico][MARKETING_SIN_REGISTRAR] lead guardado sin opt-in de marketing (¿migración 20261012001900?)",
    );
    logError(e);
  }
}

/** Sin consentimiento registrado no se deja un prospecto nuevo: se borra el recién creado. */
async function rollbackProspect(admin: Admin, prospectId: string): Promise<void> {
  const { error } = await admin.from("prospects").delete().eq("id", prospectId);
  if (error)
    console.error(
      `[diagnostico] no se pudo borrar el prospecto sin consentimiento (code ${error.code ?? "?"})`,
    );
}

/** Log con tag LEAD_PERDIDO (sin PII: paso, código y prefijo del hash del correo). */
async function logLeadLost(
  outcome: SaveOutcome,
  e: unknown,
  input: DiagnosticoInput,
): Promise<void> {
  const step =
    e instanceof DbError ? e.step : `inesperado (${(e as Error)?.name ?? "desconocido"})`;
  const code = e instanceof DbError ? e.code : undefined;
  const hash = await emailHash(input).catch(() => null);
  console.error(leadLostLine({ outcome, step, code, emailHash: hash }));
}

/** Crea el prospecto o agrega la nota al existente, y registra el consentimiento. Nunca lanza. */
export async function saveDiagnosticoLead(
  input: DiagnosticoInput,
  ipHash: string | null,
): Promise<{ outcome: SaveOutcome; ownerEmail: string | null }> {
  try {
    const admin = await getAdmin();
    const target = await resolveLeadsTarget(admin);
    if (!target) {
      console.error(
        "[diagnostico] sin org destino: revisa PLATFORM_ADMIN_EMAILS y que ese usuario sea owner de una org",
      );
      await logLeadLost("no_org", new DbError("resolver org destino", "no_org"), input);
      return { outcome: "no_org", ownerEmail: null };
    }
    const presence = splitPresence(input.presencia);
    const unparsed =
      input.presencia && !presence.instagram && !presence.web ? input.presencia : null;
    const note = buildLeadNote(input, unparsed);
    // Texto libre en líneas propias (marca INFO_NOTE_MARK): recommend.ts no las lee.
    const infoLines = buildInfoNoteLines(input.info);

    const { data: created, error } = await admin
      .from("prospects")
      .insert({
        org_id: target.orgId,
        nombre: input.negocio,
        rubro: input.rubro,
        comuna: input.comuna,
        web: presence.web,
        instagram: presence.instagram,
        email_publico: input.email,
        telefono_publico: input.whatsapp,
        fuente: DIAGNOSTICO_SOURCE,
        estado: "nuevo",
        notas: [note, ...infoLines].join("\n"),
      })
      .select("id")
      .single();
    if (!error) {
      try {
        await recordConsent(admin, target.orgId, created.id, input, ipHash);
      } catch (consentError) {
        await rollbackProspect(admin, created.id);
        throw consentError;
      }
      await recordMarketingConsent(admin, target.orgId, created.id, input, ipHash);
      return { outcome: "created", ownerEmail: target.ownerEmail };
    }
    if (error.code !== UNIQUE_VIOLATION) throw new DbError("insert prospects", error.code);

    const existingId = await findExisting(admin, target.orgId, input);
    // Prospecto ya existente: el consentimiento se intenta igual; si falla, solo log.
    await recordConsent(admin, target.orgId, existingId, input, ipHash).catch(logError);
    if (!existingId) throw new DbError("buscar duplicado", "not_found");
    const { error: noteError } = await admin.rpc("append_prospect_note", {
      _prospect_id: existingId,
      _note:
        `${note} · (no verificado, enviado desde la web) WhatsApp: ${input.whatsapp} · correo: ${input.email}`.slice(
          0,
          300,
        ),
    });
    if (noteError) throw new DbError("append_prospect_note", noteError.code);
    for (const line of infoLines) {
      const { error: infoError } = await admin.rpc("append_prospect_note", {
        _prospect_id: existingId,
        _note: line,
      });
      if (infoError) logError(new DbError("append_prospect_note (info)", infoError.code));
    }
    await recordMarketingConsent(admin, target.orgId, existingId, input, ipHash);
    return { outcome: "noted", ownerEmail: target.ownerEmail };
  } catch (e) {
    logError(e);
    await logLeadLost("error", e, input);
    return { outcome: "error", ownerEmail: null };
  }
}

/** Asunto de una línea: sin CR/LF ni controles, máx. 120 caracteres. */
export function safeSubject(raw: string): string {
  return (
    raw
      // eslint-disable-next-line no-control-regex -- intencional: elimina caracteres de control
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, SUBJECT_MAX)
  );
}

const OUTCOME_LABEL: Record<SaveOutcome, string> = {
  created: "Se creó como prospecto nuevo (fuente: web: diagnóstico).",
  noted: "Ya existía: se agregó una nota al prospecto.",
  no_org: "ATENCIÓN: no se guardó en la plataforma (no se resolvió la org del administrador).",
  error: "ATENCIÓN: no se guardó en la plataforma (error de base de datos, ver logs).",
};

/** "Información adicional" en una línea, sin controles (para el aviso por correo). */
function flatInfo(raw: string | undefined): string {
  return (
    (raw ?? "")
      // eslint-disable-next-line no-control-regex -- intencional: elimina caracteres de control
      .replace(/[\u0000-\u001f\u007f\u2028\u2029\s]+/g, " ")
      .trim()
  );
}

let warnedNoMail = false;

/** Avisa una sola vez por Worker que el correo de leads está desactivado. */
function warnNoMailOnce(reason: string): void {
  if (warnedNoMail) return;
  warnedNoMail = true;
  console.warn(`[diagnostico][SIN_AVISO_CORREO] ${reason}: los leads no se avisan por correo`);
}

/** Aviso al dueño por Resend si RESEND_API_KEY existe. Nunca lanza. */
export async function notifyDiagnosticoLead(
  input: DiagnosticoInput,
  outcome: SaveOutcome,
  ownerEmail: string | null,
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) return warnNoMailOnce("falta RESEND_API_KEY");
  const to = ownerEmail ?? [...platformAdminEmails()][0];
  if (!to) return warnNoMailOnce("sin destinatario (PLATFORM_ADMIN_EMAILS vacía)");
  const lines = [
    `Nuevo pedido de diagnóstico gratis desde vibranding.pro.`,
    OUTCOME_LABEL[outcome],
    "",
    `Negocio: ${input.negocio}`,
    `Rubro: ${input.rubro}`,
    `Comuna: ${input.comuna}`,
    `Instagram o web: ${input.presencia || "-"}`,
    `WhatsApp: ${input.whatsapp}`,
    `Email: ${input.email}`,
    `Quiere lograr: ${goalLabel(input.objetivo)}`,
    `Presupuesto: ${budgetLabel(input.presupuesto) ?? "-"}`,
    `Plan de interés: ${input.plan ?? "-"}`,
    `Acepta correos de marketing: ${input.marketing ? "sí" : "no"}`,
    `Información adicional: ${flatInfo(input.info) || "-"}`,
  ];
  try {
    await sendViaResend(apiKey, process.env["RESEND_FROM"]?.trim() || DEFAULT_FROM, {
      kind: "dueño",
      to,
      subject: safeSubject(`Diagnóstico gratis: ${input.negocio} (${input.comuna})`),
      text: lines.join("\n"),
      html: toHtml(lines),
      replyTo: input.email,
    });
  } catch (e) {
    // Estado HTTP + fragmento del error con los correos ocultos.
    const message = (e as Error)?.message ?? "";
    const status = /Resend (\d+)/.exec(message)?.[1] ?? "?";
    console.error(
      `[diagnostico][AVISO_CORREO_FALLO] status ${status} · ${safeSnippet(message) || "sin detalle"}`,
    );
  }
}
