/**
 * Estado del formulario de onboarding en el navegador y validación por paso
 * (las reglas viven en src/lib/onboarding/schema.ts).
 */
import type { ZodTypeAny } from "zod";
import {
  AccessStep,
  BillingStep,
  BusinessStep,
  FilesStep,
  LINK_KEYS,
  normalizeLink,
  SocialStep,
  type AccessState,
  type LinkKey,
  type OnboardingFormData,
} from "@/lib/onboarding/schema";

export interface AccessRow {
  id: string;
  servicio: string;
  estado: AccessState;
  nota: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  path?: string;
  error?: string;
}

export interface FormState {
  razon_social: string;
  rut: string;
  giro: string;
  direccion: string;
  email_facturacion: string;
  contacto_nombre: string;
  contacto_telefono: string;
  contacto_email: string;
  descripcion: string;
  publico_objetivo: string;
  competencia: string;
  estilo: string;
  /** Colores separados por coma, tal como los escribe el cliente. */
  colores: string;
  links_redes: Record<LinkKey, string>;
  accesos: AccessRow[];
  archivos: UploadedFile[];
}

export type TextField = Exclude<keyof FormState, "links_redes" | "accesos" | "archivos">;

/** Errores por campo: "rut", "links_redes.instagram", "accesos_pendientes.2.nota", … */
export type FieldErrors = Record<string, string>;

const DEFAULT_SERVICES = [
  "Instagram",
  "Facebook / Meta Business Suite",
  "Cuenta publicitaria de Meta",
  "TikTok",
  "Perfil de Google (Maps)",
  "Sitio web / dominio",
];

let rowSeq = 0;
export function newRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

export function initialState(): FormState {
  return {
    razon_social: "",
    rut: "",
    giro: "",
    direccion: "",
    email_facturacion: "",
    contacto_nombre: "",
    contacto_telefono: "",
    contacto_email: "",
    descripcion: "",
    publico_objetivo: "",
    competencia: "",
    estilo: "",
    colores: "",
    links_redes: Object.fromEntries(LINK_KEYS.map((k) => [k, ""])) as Record<LinkKey, string>,
    accesos: DEFAULT_SERVICES.map((servicio) => ({ id: newRowId(), servicio, estado: "pendiente", nota: "" })),
    archivos: [],
  };
}

export function splitColors(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Estado → datos del esquema (sin filas de acceso vacías ni archivos fallidos). */
export function toFormData(s: FormState): OnboardingFormData {
  return {
    razon_social: s.razon_social,
    rut: s.rut,
    giro: s.giro,
    direccion: s.direccion,
    email_facturacion: s.email_facturacion,
    contacto_nombre: s.contacto_nombre,
    contacto_telefono: s.contacto_telefono,
    contacto_email: s.contacto_email,
    descripcion: s.descripcion,
    publico_objetivo: s.publico_objetivo,
    competencia: s.competencia,
    estilo: s.estilo,
    colores: splitColors(s.colores),
    links_redes: Object.fromEntries(
      Object.entries(s.links_redes).map(([k, v]) => [k, normalizeLink(k as LinkKey, v)]),
    ) as Record<LinkKey, string>,
    accesos_pendientes: s.accesos
      .filter((a) => a.servicio.trim() || a.nota.trim())
      .map(({ servicio, estado, nota }) => ({ servicio, estado, nota })),
    archivos: s.archivos.flatMap((f) => (f.status === "done" && f.path ? [f.path] : [])),
  };
}

export const STEPS: ReadonlyArray<{ title: string; short: string; schema: ZodTypeAny }> = [
  { title: "Datos de facturación", short: "Facturación", schema: BillingStep },
  { title: "Tu negocio", short: "Negocio", schema: BusinessStep },
  { title: "Redes sociales", short: "Redes", schema: SocialStep },
  { title: "Accesos", short: "Accesos", schema: AccessStep },
  { title: "Archivos", short: "Archivos", schema: FilesStep },
];

/**
 * Valida un paso. Las filas de accesos se indexan como en `s.accesos` (no en
 * la lista filtrada) para marcar la fila correcta.
 */
export function validateStep(step: number, s: FormState): FieldErrors {
  const rows = s.accesos.filter((a) => a.servicio.trim() || a.nota.trim());
  const result = STEPS[step].schema.safeParse(toFormData(s));
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = [...issue.path];
    if (path[0] === "accesos_pendientes" && typeof path[1] === "number") {
      path[1] = s.accesos.indexOf(rows[path[1]]);
    }
    const key = path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
