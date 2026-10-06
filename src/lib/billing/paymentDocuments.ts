/**
 * Documento tributario manual de un cobro (boleta o factura en PDF).
 * Compartido por el navegador (validación previa) y el servidor (validación real).
 */

export const PAYMENT_DOCUMENT_KINDS = ["boleta", "factura"] as const;
export type PaymentDocumentKind = (typeof PAYMENT_DOCUMENT_KINDS)[number];

export const PAYMENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const PAYMENT_DOCUMENT_MIME = "application/pdf";
/** Largo máximo del base64 de un PDF de 10 MB. */
export const PAYMENT_DOCUMENT_MAX_BASE64 = Math.ceil(PAYMENT_DOCUMENT_MAX_BYTES / 3) * 4;

export const PAYMENT_DOCUMENT_LABEL: Readonly<Record<PaymentDocumentKind, string>> = {
  boleta: "Boleta",
  factura: "Factura",
};

export const PAYMENT_DOCUMENT_ERRORS = {
  badType: "Sube un archivo PDF.",
  tooBig: "El PDF supera los 10 MB.",
  empty: "El archivo está vacío.",
} as const;

export function isPaymentDocumentKind(value: unknown): value is PaymentDocumentKind {
  return (PAYMENT_DOCUMENT_KINDS as readonly unknown[]).includes(value);
}

/** Ruta fija en el bucket privado `onboarding` (la BD exige exactamente esta forma). */
export function paymentDocumentPath(clientId: string, paymentId: string): string {
  return `documentos/${clientId}/${paymentId}.pdf`;
}

/** Etiqueta del botón de descarga: "Boleta", "Factura" o genérica si no se indicó el tipo. */
export function paymentDocumentLabel(kind: string | null | undefined): string {
  return isPaymentDocumentKind(kind) ? PAYMENT_DOCUMENT_LABEL[kind] : "Boleta/Factura";
}
