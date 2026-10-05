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
  DIAGNOSTICO_SOURCE,
  budgetLabel,
  goalLabel,
  splitPresence,
  type DiagnosticoInput,
} from "./diagnostico.schema";

const ORG_CACHE_MS = 10 * 60 * 1000;
const USERS_PER_PAGE = 200;
const MAX_USER_PAGES = 25;
const UNIQUE_VIOLATION = "23505";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type Target = { orgId: string; ownerEmail: string };

let cachedTarget: { value: Target; at: number } | null = null;

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
    if (error) throw new Error(`listUsers: ${error.message}`);
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
  if (cachedTarget && now - cachedTarget.at < ORG_CACHE_MS) return cachedTarget.value;
  const user = await findPlatformAdminUser(admin);
  if (!user) return null;
  const { data, error } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`org_members: ${error.message}`);
  if (!data) return null;
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

/** Crea el prospecto o agrega la nota al existente. Nunca lanza: devuelve el resultado. */
export async function saveDiagnosticoLead(input: DiagnosticoInput): Promise<{ outcome: SaveOutcome; ownerEmail: string | null }> {
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

    const { error } = await admin.from("prospects").insert({
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
    });
    if (!error) return { outcome: "created", ownerEmail: target.ownerEmail };
    if (error.code !== UNIQUE_VIOLATION) throw new Error(`insert prospects: ${error.code ?? ""} ${error.message}`);

    const existingId = await findExisting(admin, target.orgId, input);
    if (!existingId) throw new Error("prospecto duplicado pero no encontrado (clave nombre+comuna)");
    const { error: noteError } = await admin.rpc("append_prospect_note", {
      _prospect_id: existingId,
      _note: `${note} · WhatsApp: ${input.whatsapp} · correo: ${input.email}`.slice(0, 300),
    });
    if (noteError) throw new Error(`append_prospect_note: ${noteError.message}`);
    return { outcome: "noted", ownerEmail: target.ownerEmail };
  } catch (e) {
    // Sin datos del visitante en el log: solo el motivo técnico.
    console.error("[diagnostico] no se pudo guardar el prospecto:", (e as Error)?.message ?? e);
    return { outcome: "error", ownerEmail: null };
  }
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
      subject: `Diagnóstico gratis: ${input.negocio} (${input.comuna})`,
      text: lines.join("\n"),
      html: toHtml(lines),
      replyTo: input.email,
    });
  } catch (e) {
    console.error("[diagnostico] aviso por correo falló:", (e as Error)?.message ?? e);
  }
}
