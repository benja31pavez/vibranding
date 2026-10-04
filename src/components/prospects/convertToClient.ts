import { supabase } from "@/integrations/supabase/client";
import { findPlan, type Plan } from "@/lib/pricing/plans";
import { normalizeInstagram } from "@/lib/prospects/schema";
import { NO_PERMISSION, writeError, type Prospect } from "./prospectsData";

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
    p.email_publico && `Correo: ${p.email_publico}`,
    p.telefono_publico && `Teléfono: ${p.telefono_publico}`,
  ];
  return lines.filter(Boolean).join("\n");
}

async function assignPlan(clientId: string, plan: Plan): Promise<string | null> {
  const values = { plan_key: plan.key, mrr: plan.billing === "monthly" ? plan.price : 0 };
  const upd = await supabase.from("client_billing").update(values).eq("client_id", clientId).select("client_id");
  if (upd.error) return writeError(upd.error);
  if (upd.data && upd.data.length > 0) return null;
  // 0 filas: falta la fila 1:1 (el trigger no corrió) o no hay permisos; el INSERT lo distingue.
  const ins = await supabase.from("client_billing").insert({ client_id: clientId, ...values }).select("client_id");
  if (ins.error) return writeError(ins.error);
  return ins.data && ins.data.length > 0 ? null : NO_PERMISSION;
}

/**
 * Crea el cliente (clients + client_billing con el plan sugerido) y marca el prospecto
 * como ganado. Si el cliente se crea pero falla un paso posterior, devuelve ok con avisos.
 */
export async function convertToClient(prospect: Prospect, userId: string): Promise<ConvertResult> {
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

  if (prospect.estado !== "ganado") {
    const upd = await supabase.from("prospects").update({ estado: "ganado" }).eq("id", prospect.id).select("id");
    const err = upd.error ? writeError(upd.error) : !upd.data?.length ? NO_PERMISSION : null;
    if (err) warnings.push(`El cliente se creó, pero el prospecto no quedó como ganado: ${err}`);
  }

  return { ok: true, clientId, warnings };
}

/** Clientes de la org con el mismo nombre (para avisar antes de duplicar). */
export async function findClientsByName(orgId: string, name: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id,name")
    .eq("org_id", orgId)
    .ilike("name", name.trim().replace(/[%_\\]/g, (c) => `\\${c}`))
    .limit(5);
  if (error) throw new Error(error.message);
  return data ?? [];
}
