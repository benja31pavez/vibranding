/**
 * Boleta/factura de un cobro: subida (solo editores de la agencia) y descarga
 * con URL firmada corta (agencia o el propio cliente). El archivo vive en el
 * bucket privado `onboarding` bajo `documentos/<client_id>/<payment_id>.pdf`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PAYMENT_DOCUMENT_ERRORS,
  PAYMENT_DOCUMENT_KINDS,
  PAYMENT_DOCUMENT_MAX_BASE64,
} from "./paymentDocuments";

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const UploadInput = z.object({
  paymentId: z.string().uuid(),
  kind: z.enum(PAYMENT_DOCUMENT_KINDS),
  dataBase64: z
    .string()
    .min(1, PAYMENT_DOCUMENT_ERRORS.empty)
    .max(PAYMENT_DOCUMENT_MAX_BASE64, PAYMENT_DOCUMENT_ERRORS.tooBig)
    .regex(BASE64_RE, PAYMENT_DOCUMENT_ERRORS.badType),
});

const DownloadInput = z.object({ paymentId: z.string().uuid() });

/** Sube (o reemplaza) el PDF de la boleta/factura de un cobro. */
export const uploadPaymentDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof UploadInput>) => UploadInput.parse(d))
  .handler(async ({ data, context }): Promise<{ uploadedAt: string }> => {
    const { savePaymentDocument } = await import("./paymentDocuments.server");
    return savePaymentDocument(context.userId, data);
  });

/** URL firmada (5 min) para descargar el documento de un cobro. */
export const getPaymentDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string }) => DownloadInput.parse(d))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { signPaymentDocument } = await import("./paymentDocuments.server");
    return signPaymentDocument(context.userId, data.paymentId);
  });
