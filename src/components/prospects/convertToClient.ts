import { supabase } from "@/integrations/supabase/client";
import { findPlan, type Plan } from "@/lib/pricing/plans";
import { clientMark, convertedClientId, normalizeInstagram, normalizeName } from "@/lib/prospects/schema";
import { NO_PERMISSION, isMissingRpc, writeError, type Prospect } from "./prospectsData";

export type ConvertResult =
  | { ok: true; clientId: string; warnings: string[] }
  | { ok: false; error: string };

/** Plan a asignar: el producto sugerido del prospecto, si es un plan vigente. */
export function suggestedPlan(prospect: Pick<Prospect, "producto_sugerido">): Plan | null {
  return findPlan(prospect.producto_sugerido);
}

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function clientNotes(p: Prospect): string {
  const lines = [
    `Convertido desde prospecto (${p.fuente}).`,
    p.rubro && `Rubro: ${p.rubro}`,
    p.comuna && `Comuna: ${p.comuna}`,
    p.web && `Web: ${p.web}`,
  ];
  return lines.filter(Boolean).join("\n");
}

async function assignPlan(clientId: string, plan: Plan): Promise<string | null> {
  const values = { plan_key: plan.key, mrr: planMrr(plan) };
  const upd = await supabase.from("client_billing").update(values).eq("client_id", clientId).select("client_id");
  if (upd.error) return writeError(upd.error);
  if (upd.data && upd.data.length > 0) return null;
  // 0 filas: falta la fila 1:1 (el trigger no corrió) o no hay permisos; el INSERT lo distingue.
  const ins = await supabase.from("client_billing").insert({ client_id: clientId, ...values }).select("client_id");
  if (ins.error) return writeError(ins.error);
  return ins.data && ins.data.length > 0 ? null : NO_PERMISSION;
}

function planMrr(plan: Plan | null): number {
  return plan && plan.billing === "monthly" ? plan.price : 0;
}

type RpcOutcome = { kind: "missing" } | { kind: "done"; result: ConvertResult };

/**
 * convert_prospect_to_client (v3): una transacción, idempotente (si ya hay client_id lo
 * devuelve) y enlaza por prospects.client_id. Después completa en la ficha del cliente
 * los datos que la RPC no copia (rubro y notas), sin bloquear si falla.
 */
async function convertWithRpc(prospect: Prospect): Promise<RpcOutcome> {
  const plan = suggestedPlan(prospect);
  const { data, error } = await supabase.rpc("convert_prospect_to_client", {
    _prospect_id: prospect.id,
    // La función acepta NULL (sin plan); el tipo generado no lo refleja.
    _plan_key: (plan?.key ?? null) as string,
    _mrr_clp: planMrr(plan),
  });
  if (isMissingRpc(error)) return { kind: "missing" };
  if (error) return { kind: "done", result: { ok: false, error: `No se pudo crear el cliente: ${writeError(error)}` } };
  const res = data as { client_id?: string; created?: boolean } | null;
  const clientId = res?.client_id;
  if (!clientId) return { kind: "done", result: { ok: false, error: `No se pudo crear el cliente: ${NO_PERMISSION}` } };

  const warnings: string[] = [];
  if (!res.created) return { kind: "done", result: { ok: true, clientId, warnings } };
  if (!plan) warnings.push("El prospecto no tenía plan sugerido: asígnalo en la ficha del cliente.");
  const upd = await supabase
    .from("clients")
    .update({ business_description: prospect.rubro, notes: clientNotes(prospect) })
    .eq("id", clientId)
    .select("id");
  const err = upd.error ? writeError(upd.error) : !upd.data?.length ? NO_PERMISSION : null;
  if (err) warnings.push(`El cliente se creó, pero no se pudieron copiar el rubro y las notas: ${err}`);
  return { kind: "done", result: { ok: true, clientId, warnings } };
}

/**
 * Crea el cliente (clients + client_billing con el plan sugerido) y marca el prospecto
 * como ganado. Usa la RPC de la v3; si aún no existe, cae al flujo anterior (inserts
 * desde el navegador + marca en notas). Si el cliente se crea pero falla un paso
 * posterior, devuelve ok con avisos.
 */
export async function convertToClient(prospect: Prospect, userId: string): Promise<ConvertResult> {
  if (prospect.estado === "baja") return { ok: false, error: "Un prospecto dado de baja no se puede convertir en cliente." };
  if (prospect.estado !== "ganado") return { ok: false, error: "Solo se convierten prospectos en estado Ganado." };
  const already = convertedClientId(prospect);
  if (already) return { ok: false, error: "Este prospecto ya se convirtió en cliente." };
  try {
    const sameName = await findClientsByName(prospect.org_id, prospect.nombre);
    if (sameName.length > 0) return { ok: false, error: `Ya existe el cliente "${sameName[0].name}".` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo revisar si el cliente ya existe." };
  }

  const viaRpc = await convertWithRpc(prospect);
  if (viaRpc.kind === "done") return viaRpc.result;
  return convertLegacy(prospect, userId);
}

/** Flujo anterior a la v3: inserts desde el navegador y marca "[Cliente: id]" en las notas. */
async function convertLegacy(prospect: Prospect, userId: string): Promise<ConvertResult> {

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: prospect.nombre.trim(),
      org_id: prospect.org_id,
      user_id: userId,
      status: "onboarding",
      started_at: todayIso(),
      instagram_handle: prospect.instagram ? normalizeInstagram(prospect.instagram) : null,
      business_description: prospect.rubro,
      notes: clientNotes(prospect),
    })
    .select("id");
  if (error) return { ok: false, error: `No se pudo crear el cliente: ${writeError(error)}` };
  const clientId = data?.[0]?.id;
  if (!clientId) return { ok: false, error: `No se pudo crear el cliente: ${NO_PERMISSION}` };

  const warnings: string[] = [];
  const plan = suggestedPlan(prospect);
  if (plan) {
    const planError = await assignPlan(clientId, plan);
    if (planError) warnings.push(`El cliente se creó, pero no se pudo asignar el plan ${plan.label}: ${planError}`);
  } else {
    warnings.push("El prospecto no tenía plan sugerido: asígnalo en la ficha del cliente.");
  }

  // Marca de conversión en las notas (enlaza al cliente y evita convertir dos veces).
  const notas = [prospect.notas?.trim(), clientMark(clientId)].filter(Boolean).join("\n");
  const upd = await supabase
    .from("prospects")
    .update({ estado: "ganado", notas })
    .eq("id", prospect.id)
    .neq("estado", "baja")
    .select("id");
  const err = upd.error ? writeError(upd.error) : !upd.data?.length ? NO_PERMISSION : null;
  if (err) warnings.push(`El cliente se creó, pero no se pudo enlazar al prospecto: ${err}. No lo conviertas de nuevo.`);

  return { ok: true, clientId, warnings };
}

/** Clientes de la org con el mismo nombre normalizado (sin tildes, mayúsculas ni espacios extra). */
export async function findClientsByName(orgId: string, name: string): Promise<{ id: string; name: string }[]> {
  const target = normalizeName(name);
  // Prefiltro en la BD por la primera palabra; la igualdad exacta normalizada se aplica aquí.
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  const pattern = `%${firstWord.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await supabase
    .from("clients")
    .select("id,name")
    .eq("org_id", orgId)
    .ilike("name", pattern)
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((c) => normalizeName(c.name) === target);
}
