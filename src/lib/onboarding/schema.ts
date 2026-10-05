/**
 * Reglas del formulario de onboarding (/onboarding/$token).
 *
 * Espejo de private.parse_onboarding_payload() / submit_onboarding() de la
 * migración v3: mismas claves, largos y formatos. La BD vuelve a validar todo;
 * esto existe para dar errores claros por campo antes de enviar.
 * Se usa en el navegador y en el servidor (sin imports de servidor).
 */
import { z } from "zod";
import { formatRut, isValidRut } from "@/lib/proposals/rut";

export const TOKEN_RE = /^[0-9a-f]{48}$/;

// ------------------------------------------------------------------ archivos

export const MAX_FILES = 20;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Mismos tipos que allowed_mime_types del bucket 'onboarding' (sin SVG ni ZIP). */
export const FILE_TYPES: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const FILE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf";
const SAFE_NAME_MAX = 100;

/**
 * Nombre ASCII seguro para Storage: solo [A-Za-z0-9._-], sin "..", empieza con
 * alfanumérico, máx. 100 caracteres y con la extensión del tipo declarado.
 */
export function safeFileName(original: string, contentType: string): string {
  const ext = FILE_TYPES[contentType] ?? "bin";
  const base = original
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[-.]+$/, "");
  const room = SAFE_NAME_MAX - ext.length - 1;
  return `${base.slice(0, room).replace(/[-.]+$/, "") || "archivo"}.${ext}`;
}

/** Nombre visible de un path "<client_id>/<uuid>-<nombre>". */
export function displayFileName(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

/** Path válido para un cliente (mismo patrón que la BD). */
export function isClientFilePath(clientId: string, path: string): boolean {
  const prefix = `${clientId}/`;
  return (
    path.length <= 300 &&
    path.startsWith(prefix) &&
    !path.includes("..") &&
    /^[A-Za-z0-9][A-Za-z0-9._ -]{0,250}$/.test(path.slice(prefix.length))
  );
}

export const UploadRequest = z.object({
  token: z.string().regex(TOKEN_RE, "Link inválido"),
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().refine((t) => t in FILE_TYPES, "Solo se aceptan PNG, JPG, WEBP o PDF"),
  size: z
    .number()
    .int()
    .positive("El archivo está vacío")
    .max(MAX_FILE_BYTES, "El archivo supera 10 MB"),
});
export type UploadRequestData = z.infer<typeof UploadRequest>;

// ------------------------------------------------------------------ campos

/** Igual que email_re de la BD. */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()-]{6,30}$/;
const LINK_RE = /^(https?:\/\/[^\s<>"]+|@?[A-Za-z0-9._-]{1,100})$/;
/** Igual que private.looks_like_secret(). */
const SECRET_RE = /(contrase(ñ|n)a|password|passwd|clave|pin)\s*[:=]/i;

export const LINK_KEYS = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
  "x",
  "web",
  "otro",
] as const;
export type LinkKey = (typeof LINK_KEYS)[number];
export const LINK_LABELS: Readonly<Record<LinkKey, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X (Twitter)",
  web: "Sitio web",
  otro: "Otro",
};

/**
 * Agrega https:// a un dominio escrito sin esquema ("tunegocio.cl",
 * "instagram.com/x"). En redes, "cafe.lalo" es un @usuario: solo se completa
 * si empieza con www. o trae una ruta.
 */
export function normalizeLink(key: LinkKey, value: string): string {
  const v = value.trim();
  if (!/^(www\.)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(\/\S*)?$/.test(v)) return v;
  const looksLikeUrl = key === "web" || key === "otro" || v.startsWith("www.") || v.includes("/");
  return looksLikeUrl ? `https://${v}` : v;
}

export const ACCESS_STATES = ["pendiente", "compartido", "no_aplica"] as const;
export type AccessState = (typeof ACCESS_STATES)[number];
export const ACCESS_STATE_LABELS: Readonly<Record<AccessState, string>> = {
  pendiente: "Pendiente",
  compartido: "Ya lo compartí",
  no_aplica: "No tengo / no aplica",
};
export const MAX_ACCESSES = 30;
export const MAX_COLORS = 12;
const MAX_PAYLOAD_BYTES = 65536;

const NO_SECRET = "No escribas contraseñas: solo indica el estado del acceso.";

/** Texto opcional: recorta y limita el largo (vacío = no se envía). */
const optText = (max: number, label: string) =>
  z.string().trim().max(max, `${label}: máximo ${max} caracteres`);

const optPattern = (max: number, re: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .refine((v) => v === "" || re.test(v), message);

export const BillingStep = z.object({
  razon_social: z
    .string()
    .trim()
    .min(1, "Escribe la razón social o el nombre del negocio")
    .max(200, "Máximo 200 caracteres"),
  rut: z
    .string()
    .trim()
    .max(20, "RUT inválido")
    .refine(
      (v) => v === "" || (isValidRut(v) && formatRut(v).length <= 12),
      "El RUT no es válido. Revisa el dígito verificador.",
    ),
  giro: optText(200, "Giro"),
  direccion: optText(300, "Dirección"),
  email_facturacion: optPattern(
    254,
    EMAIL_RE,
    "Escribe un email válido (ej. facturas@tunegocio.cl)",
  ),
  contacto_nombre: optText(120, "Nombre"),
  contacto_telefono: optPattern(30, PHONE_RE, "Escribe un teléfono válido (ej. +56 9 1234 5678)"),
  contacto_email: optPattern(254, EMAIL_RE, "Escribe un email válido"),
});

export const BusinessStep = z.object({
  descripcion: optText(4000, "Descripción"),
  publico_objetivo: optText(2000, "Público objetivo"),
  competencia: optText(2000, "Competencia"),
  estilo: optText(2000, "Estilo"),
  colores: z
    .array(z.string().trim().min(1).max(40, "Cada color: máximo 40 caracteres"))
    .max(MAX_COLORS, `Máximo ${MAX_COLORS} colores`),
});

export const SocialStep = z.object({
  links_redes: z.record(
    z.enum(LINK_KEYS),
    optPattern(300, LINK_RE, "Pega el link completo (https://…) o tu @usuario, sin espacios"),
  ),
});

export const AccessItem = z
  .object({
    servicio: z
      .string()
      .trim()
      .min(1, "Indica el servicio")
      .max(80, "Máximo 80 caracteres")
      .refine((v) => !SECRET_RE.test(v), NO_SECRET),
    estado: z.enum(ACCESS_STATES),
    nota: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres")
      .refine((v) => !SECRET_RE.test(v), NO_SECRET)
      .optional(),
  })
  .strict();
export type AccessItemData = z.infer<typeof AccessItem>;

export const AccessStep = z.object({
  accesos_pendientes: z.array(AccessItem).max(MAX_ACCESSES, `Máximo ${MAX_ACCESSES} accesos`),
});

export const FilesStep = z.object({
  archivos: z.array(z.string().min(1).max(300)).max(MAX_FILES, `Máximo ${MAX_FILES} archivos`),
});

export const OnboardingForm = BillingStep.merge(BusinessStep)
  .merge(SocialStep)
  .merge(AccessStep)
  .merge(FilesStep);
export type OnboardingFormData = z.input<typeof OnboardingForm>;

/** Payload final para submit_onboarding(): solo claves permitidas, sin vacíos. */
export type OnboardingPayload = Record<
  string,
  string | string[] | Record<string, string> | AccessItemData[]
>;

export function buildPayload(form: z.output<typeof OnboardingForm>): OnboardingPayload {
  const payload: OnboardingPayload = {};
  const texts = [
    "razon_social",
    "giro",
    "direccion",
    "email_facturacion",
    "contacto_nombre",
    "contacto_telefono",
    "contacto_email",
    "descripcion",
    "publico_objetivo",
    "competencia",
    "estilo",
  ] as const;
  for (const key of texts) {
    if (form[key]) payload[key] = key.includes("email") ? form[key].toLowerCase() : form[key];
  }
  if (form.rut) payload.rut = formatRut(form.rut);
  if (form.colores.length) payload.colores = form.colores;
  const links = Object.fromEntries(Object.entries(form.links_redes).filter(([, v]) => v));
  if (Object.keys(links).length) payload.links_redes = links as Record<string, string>;
  if (form.accesos_pendientes.length) {
    payload.accesos_pendientes = form.accesos_pendientes.map((a) =>
      a.nota ? a : ({ servicio: a.servicio, estado: a.estado } as AccessItemData),
    );
  }
  if (form.archivos.length) payload.archivos = form.archivos;
  return payload;
}

/**
 * Validación del payload en el servidor antes de llamar a la BD: claves
 * permitidas (strict), mismos largos/formatos y razón social obligatoria.
 */
export const PayloadSchema = OnboardingForm.partial()
  .strict()
  .extend({ razon_social: BillingStep.shape.razon_social });

/** Primer error de zod como error de campo (mismo formato que mapDbError). */
export function zodFieldError(error: z.ZodError): FieldError {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : null;
  if (issue?.code === "unrecognized_keys") {
    return field === "accesos_pendientes"
      ? { field, message: "Cada acceso lleva solo servicio, estado y nota (nunca contraseñas)." }
      : { field: null, message: "El formulario trae campos no permitidos." };
  }
  return {
    field: field && field in FIELD_STEP ? field : null,
    message: issue?.message ?? "Revisa los datos del formulario.",
  };
}

export function payloadTooLarge(payload: OnboardingPayload): boolean {
  return new TextEncoder().encode(JSON.stringify(payload)).length > MAX_PAYLOAD_BYTES;
}

// ------------------------------------------------------------------ errores de la BD (22023)

/** Paso del formulario donde vive cada campo (para llevar al cliente al error). */
export const FIELD_STEP: Readonly<Record<string, number>> = {
  razon_social: 0,
  rut: 0,
  giro: 0,
  direccion: 0,
  email_facturacion: 0,
  contacto_nombre: 0,
  contacto_telefono: 0,
  contacto_email: 0,
  descripcion: 1,
  publico_objetivo: 1,
  competencia: 1,
  estilo: 1,
  colores: 1,
  links_redes: 2,
  accesos_pendientes: 3,
  archivos: 4,
};

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  razon_social: "Revisa la razón social: es obligatoria y de hasta 200 caracteres.",
  rut: "El RUT no es válido. Revisa el dígito verificador.",
  giro: "El giro es demasiado largo.",
  direccion: "La dirección es demasiado larga.",
  contacto_nombre: "El nombre de contacto es demasiado largo.",
  contacto_telefono: "Revisa el teléfono (ej. +56 9 1234 5678).",
  contacto_email: "Revisa el email de contacto.",
  email_facturacion: "Revisa el email de facturación.",
  descripcion: "La descripción del negocio es demasiado larga.",
  publico_objetivo: "El texto de público objetivo es demasiado largo.",
  competencia: "El texto de competencia es demasiado largo.",
  estilo: "El texto de estilo es demasiado largo.",
  colores: "Revisa los colores: hasta 12, de hasta 40 caracteres cada uno.",
  links_redes: "Revisa tus redes: pega el link completo (https://…) o tu @usuario.",
  accesos_pendientes: "Revisa la lista de accesos. Recuerda: nunca escribas contraseñas.",
  archivos: "Uno de los archivos no se subió bien. Quítalo y vuelve a subirlo.",
};

export interface FieldError {
  field: string | null;
  message: string;
}

/**
 * Traduce el mensaje 22023 de parse_onboarding_payload() a un campo y un texto
 * claro. Ej.: "campo rut inválido", "links_redes.instagram inválido",
 * "accesos_pendientes: no envíes contraseñas…", "archivos: … no existe".
 */
export function mapDbError(raw: string | null | undefined): FieldError {
  const text = raw ?? "";
  const link = /^links_redes[.:]\s*(?:red\s+)?([a-z]+)/.exec(text);
  if (link) {
    const label = LINK_LABELS[link[1] as LinkKey];
    return {
      field: "links_redes",
      message: label
        ? `Revisa tu ${label}: pega el link completo (https://…) o tu @usuario.`
        : FIELD_MESSAGES.links_redes,
    };
  }
  if (/contraseñ/i.test(text)) return { field: "accesos_pendientes", message: NO_SECRET };
  const field = /^campo\s+([a-z_]+)/.exec(text)?.[1] ?? /^([a-z_]+):/.exec(text)?.[1] ?? null;
  if (field && FIELD_MESSAGES[field]) return { field, message: FIELD_MESSAGES[field] };
  return {
    field: null,
    message: "Algunos datos no tienen el formato esperado. Revísalos e intenta de nuevo.",
  };
}
