import { supabase } from "@/integrations/supabase/client";

/** Contacto del cliente para mensajes manuales (recordar pago, pedir reseña). */
export interface ClientContact {
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** Contacto del cliente: ficha de onboarding y, si falta el correo, el usuario del portal. */
export async function loadClientContact(clientId: string): Promise<ClientContact> {
  const [intake, portalUser] = await Promise.all([
    supabase
      .from("client_intake")
      .select("contacto_nombre,contacto_telefono,contacto_email,email_facturacion")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("client_users")
      .select("email")
      .eq("client_id", clientId)
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);
  if (intake.error) throw intake.error;
  if (portalUser.error)
    console.warn("[cobros] no se pudo leer el correo del portal", portalUser.error);
  const i = intake.data;
  return {
    name: i?.contacto_nombre?.trim() || null,
    phone: i?.contacto_telefono?.trim() || null,
    email:
      i?.email_facturacion?.trim() ||
      i?.contacto_email?.trim() ||
      portalUser.data?.[0]?.email?.trim() ||
      null,
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
