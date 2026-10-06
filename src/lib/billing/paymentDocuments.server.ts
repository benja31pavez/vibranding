/**
 * Lógica de servidor (service_role) del documento tributario de un cobro.
 * Toda autorización se resuelve contra el cliente DUEÑO del cobro, nunca contra
 * un client_id del input.
 */
import {
  ClientAccessError,
  assertCanEditClient,
  getClientOrgRole,
} from "@/lib/auth/clientAccess.server";
import {
  PAYMENT_DOCUMENT_ERRORS,
  PAYMENT_DOCUMENT_MAX_BYTES,
  PAYMENT_DOCUMENT_MIME,
  paymentDocumentPath,
  type PaymentDocumentKind,
} from "./paymentDocuments";

const BUCKET = "onboarding";
const READ_URL_TTL_SECONDS = 5 * 60;
const NO_ACCESS = "No tienes acceso a este cobro";
/** Firma de un PDF: "%PDF-". */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

interface PaymentRef {
  id: string;
  client_id: string;
  document_path: string | null;
  document_type: string | null;
  period: string | null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadPaymentRef(paymentId: string): Promise<PaymentRef> {
  const db = await admin();
  const { data, error } = await db
    .from("payments")
    .select("id,client_id,document_path,document_type,period")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) {
    console.error("[payment-document] no se pudo leer el cobro", paymentId, error.message);
    throw new Error("No pudimos verificar el cobro. Intenta de nuevo.");
  }
  // Mismo mensaje si no existe o no es tuyo: no revela qué ids existen.
  if (!data) throw new ClientAccessError(NO_ACCESS);
  return data as PaymentRef;
}

/** Agencia (cualquier rol de la org del cliente) o el usuario invitado de ESE cliente. */
async function assertCanViewClient(userId: string, clientId: string): Promise<void> {
  if (await getClientOrgRole(userId, clientId)) return;
  const db = await admin();
  const { data, error } = await db
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    console.error("[payment-document] no se pudo verificar client_users", error.message);
    throw new Error("No pudimos verificar tu acceso. Intenta de nuevo.");
  }
  if (!data) throw new ClientAccessError(NO_ACCESS);
}

function decodePdf(dataBase64: string): Uint8Array {
  const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
  if (bytes.length === 0) throw new Error(PAYMENT_DOCUMENT_ERRORS.empty);
  if (bytes.length > PAYMENT_DOCUMENT_MAX_BYTES) throw new Error(PAYMENT_DOCUMENT_ERRORS.tooBig);
  if (!PDF_MAGIC.every((b, i) => bytes[i] === b)) throw new Error(PAYMENT_DOCUMENT_ERRORS.badType);
  return bytes;
}

export async function savePaymentDocument(
  userId: string,
  input: { paymentId: string; kind: PaymentDocumentKind; dataBase64: string },
): Promise<{ uploadedAt: string }> {
  const payment = await loadPaymentRef(input.paymentId);
  await assertCanEditClient(userId, payment.client_id);
  const bytes = decodePdf(input.dataBase64);
  const path = paymentDocumentPath(payment.client_id, payment.id);

  const db = await admin();
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: PAYMENT_DOCUMENT_MIME, upsert: true });
  if (upErr) {
    console.error("[payment-document] no se pudo subir", payment.id, upErr.message);
    throw new Error("No pudimos subir el PDF. Intenta de nuevo.");
  }

  const uploadedAt = new Date().toISOString();
  const { error: dbErr } = await db
    .from("payments")
    .update({ document_path: path, document_type: input.kind, document_uploaded_at: uploadedAt })
    .eq("id", payment.id)
    .eq("client_id", payment.client_id);
  if (dbErr) {
    // El PDF queda sin referencia: la limpieza diaria del bucket lo borra.
    console.error("[payment-document] no se pudo registrar", payment.id, dbErr.message);
    throw new Error("Subimos el PDF pero no pudimos asociarlo al cobro. Intenta de nuevo.");
  }
  return { uploadedAt };
}

function downloadName(payment: PaymentRef): string {
  const kind = payment.document_type === "factura" ? "factura" : "boleta";
  const period = payment.period ? `-${payment.period.slice(0, 7)}` : "";
  return `${kind}-vibranding${period}.pdf`;
}

export async function signPaymentDocument(
  userId: string,
  paymentId: string,
): Promise<{ url: string }> {
  const payment = await loadPaymentRef(paymentId);
  await assertCanViewClient(userId, payment.client_id);
  const expected = paymentDocumentPath(payment.client_id, payment.id);
  if (payment.document_path !== expected) {
    throw new Error("Este cobro aún no tiene boleta ni factura.");
  }

  const db = await admin();
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(expected, READ_URL_TTL_SECONDS, { download: downloadName(payment) });
  if (error || !data?.signedUrl) {
    console.error("[payment-document] no se pudo firmar", payment.id, error?.message);
    throw new Error("No pudimos abrir el documento. Puede que ya no exista.");
  }
  return { url: data.signedUrl };
}
