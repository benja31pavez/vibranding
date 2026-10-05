/**
 * Alta automática de prospectos desde el formulario público /diagnostico.
 *
 * Destino: la org del administrador de la plataforma. Se resuelve así:
 *   1. PLATFORM_ADMIN_EMAILS (en orden) → primer usuario de Auth con ese correo
 *      CONFIRMADO;
 *   2. su org: org_members con role = 'owner' (la más antigua).
 * Si no se puede resolver (variable vacía, usuario inexistente o sin org), el
 * lead NO se guarda en otra tabla: se registra el error en el log del Worker y
 * se intenta igual el aviso por correo a PLATFORM_ADMIN_EMAILS, para no perderlo.
 * El visitante siempre ve la página de gracias (con botón de WhatsApp).
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
  budgetLabel,
  goalLabel,
  splitPresence,
  type DiagnosticoInput,
} from "./diagnostico.schema";

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
  constructor(readonly step: string, readonly code: string | undefined) {
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

async function findExisting(admin: Admin, orgId: string, input: DiagnosticoInput): Promise<string | null> {
  const byEmail = await admin
    .from("prospects")
    .select("id")
    .eq("org_id", orgId)
    .ilike("email_publico", likeLiteral(input.email))
    .limit(1)
    .maybeSingle();
  if (byEmail.data) return byEmail.data.id;
  const byName = await admin
    .from("prospects")
    .select("id")
    .eq("org_id", orgId)
    .ilike("nombre", likeLiteral(input.negocio))
    .ilike("comuna", likeLiteral(input.comuna))
    .limit(1)
    .maybeSingle();
  return byName.data?.id ?? null;
}

export type SaveOutcome = "created" | "noted" | "no_org" | "error";

/** Columnas de las tablas nuevas (aún no están en types.ts hasta aplicar la migración). */
type UntypedAdmin = {
  from: (t: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }> };
};

/** Tabla aún no creada (PostgREST PGRST205 / Postgres 42P01). */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Registra el consentimiento (Ley 21.719) en prospect_consents. Tolera que la
 * migración 20261012000200 aún no esté aplicada: log y sigue. Nunca lanza.
 */
async function recordConsent(
  admin: Admin,
  orgId: string,
  prospectId: string | null,
  input: DiagnosticoInput,
  ipHash: string | null,
): Promise<void> {
  try {
    const salt = process.env["IP_HASH_SALT"]?.trim() ?? "";
    const { error } = await (admin as unknown as UntypedAdmin).from("prospect_consents").insert({
      org_id: orgId,
      prospect_id: prospectId,
      email_hash: await sha256(`${input.email.trim().toLowerCase()}:${salt}`),
      channel: "web_diagnostico",
      consent_text: CONSENT_TEXT,
      consent_version: CONSENT_VERSION,
      ip_hash: ipHash,
    });
    if (!error) return;
    if (MISSING_TABLE.has(error.code ?? "")) {
      console.error("[diagnostico] prospect_consents no existe aún: aplica la migración 20261012000200");
      return;
    }
    throw new DbError("insert prospect_consents", error.code);
  } catch (e) {
    logError(e);
  }
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
      console.error("[diagnostico] sin org destino: revisa PLATFORM_ADMIN_EMAILS y que ese usuario sea owner de una org");
      return { outcome: "no_org", ownerEmail: null };
    }
    const presence = splitPresence(input.presencia);
    const unparsed = input.presencia && !presence.instagram && !presence.web ? input.presencia : null;
    const note = buildLeadNote(input, unparsed);

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
        notas: note,
      })
      .select("id")
      .single();
    if (!error) {
      await recordConsent(admin, target.orgId, created.id, input, ipHash);
      return { outcome: "created", ownerEmail: target.ownerEmail };
    }
    if (error.code !== UNIQUE_VIOLATION) throw new DbError("insert prospects", error.code);

    const existingId = await findExisting(admin, target.orgId, input);
    // El consentimiento se guarda igual (con o sin prospecto encontrado).
    await recordConsent(admin, target.orgId, existingId, input, ipHash);
    if (!existingId) throw new DbError("buscar duplicado", "not_found");
    const { error: noteError } = await admin.rpc("append_prospect_note", {
      _prospect_id: existingId,
      _note: `${note} · (no verificado, enviado desde la web) WhatsApp: ${input.whatsapp} · correo: ${input.email}`.slice(0, 300),
    });
    if (noteError) throw new DbError("append_prospect_note", noteError.code);
    return { outcome: "noted", ownerEmail: target.ownerEmail };
  } catch (e) {
    logError(e);
    return { outcome: "error", ownerEmail: null };
  }
}

/** Asunto de una línea: sin CR/LF ni controles, máx. 120 caracteres. */
export function safeSubject(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, SUBJECT_MAX);
}

const OUTCOME_LABEL: Record<SaveOutcome, string> = {
  created: "Se creó como prospecto nuevo (fuente: web: diagnóstico).",
  noted: "Ya existía: se agregó una nota al prospecto.",
  no_org: "ATENCIÓN: no se guardó en la plataforma (no se resolvió la org del administrador).",
  error: "ATENCIÓN: no se guardó en la plataforma (error de base de datos, ver logs).",
};

/** Aviso al dueño por Resend si RESEND_API_KEY existe. Nunca lanza. */
export async function notifyDiagnosticoLead(
  input: DiagnosticoInput,
  outcome: SaveOutcome,
  ownerEmail: string | null,
): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) return;
  const to = ownerEmail ?? [...platformAdminEmails()][0];
  if (!to) return;
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
    // Solo el estado HTTP (el mensaje de Resend puede traer la dirección).
    const status = /Resend (\d+)/.exec((e as Error)?.message ?? "")?.[1] ?? "?";
    console.error(`[diagnostico] aviso por correo falló (status ${status})`);
  }
}
