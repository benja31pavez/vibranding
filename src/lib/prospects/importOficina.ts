import { z } from "zod";
import {
  dedupeKey,
  isEmail,
  isPhone,
  prospectSchema,
  type ProspectState,
  type ProspectValues,
} from "./schema";

/**
 * Importa `data/ventas/prospectos.json` de la oficina de agentes (esquema en
 * data/ventas/README.md) al formato de la tabla `prospects`.
 */

const MAX_FILE_ROWS = 2000;

/** Estados de la oficina → estados de la plataforma. */
const STATE_MAP: Readonly<Record<string, ProspectState>> = {
  nuevo: "nuevo",
  "en-lote": "nuevo",
  aprobado: "nuevo",
  contactado: "contactado",
  respondio: "respondio",
  demo: "demo",
  propuesta: "propuesta",
  ganado: "ganado",
  perdido: "perdido",
  frio: "perdido",
  baja: "baja",
};

/** Acciones del historial que cuentan como contacto real. */
const CONTACT_ACTIONS = new Set(["enviado", "recordatorio", "respondio", "propuesta", "ganado"]);

const optStr = z.string().nullish();

const officeRowSchema = z
  .object({
    id: optStr,
    negocio: z.string({ required_error: "Falta el nombre del negocio", invalid_type_error: "Nombre inválido" }),
    rubro: optStr,
    nicho: optStr,
    comuna: optStr,
    web: optStr,
    instagram: optStr,
    canal: optStr,
    contacto: optStr,
    fuenteContacto: optStr,
    origen: z.object({ tipo: optStr, ref: optStr }).nullish(),
    senal: optStr,
    productoSugerido: optStr,
    prioridad: z.number().nullish(),
    estado: optStr,
    proximoPaso: z.object({ fecha: optStr, accion: optStr }).nullish(),
    historial: z.array(z.object({ fecha: optStr, accion: optStr, nota: optStr }).passthrough()).nullish(),
  })
  .passthrough();

type OfficeRow = z.infer<typeof officeRowSchema>;

export interface ImportCandidate {
  values: ProspectValues;
  /** Id del prospecto en la oficina (para trazabilidad). */
  officeId: string | null;
}

export interface SkippedRow {
  index: number;
  label: string;
  reason: string;
}

export interface ImportPlan {
  toInsert: ImportCandidate[];
  skipped: SkippedRow[];
  total: number;
}

export interface ExistingProspect {
  nombre: string;
  comuna: string | null;
  email_publico: string | null;
}

/** Lee el JSON (objeto con `prospectos` o arreglo directo). Lanza Error con mensaje legible. */
export function parseOfficeFile(text: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { prospectos?: unknown }).prospectos)
      ? (data as { prospectos: unknown[] }).prospectos
      : null;
  if (!rows) throw new Error("No se encontró la lista \"prospectos\" en el archivo.");
  if (rows.length > MAX_FILE_ROWS) throw new Error(`El archivo tiene más de ${MAX_FILE_ROWS} prospectos.`);
  return rows;
}

function lastContactDate(row: OfficeRow): string {
  const dates = (row.historial ?? [])
    .filter((h) => h.accion && CONTACT_ACTIONS.has(h.accion) && h.fecha && /^\d{4}-\d{2}-\d{2}/.test(h.fecha))
    .map((h) => (h.fecha as string).slice(0, 10))
    .sort();
  return dates[dates.length - 1] ?? "";
}

function buildNotes(row: OfficeRow): string {
  const lines: string[] = [];
  if (row.senal) lines.push(`Señal: ${row.senal}`);
  if (row.nicho) lines.push(`Nicho: ${row.nicho}`);
  if (row.prioridad != null) lines.push(`Prioridad: ${row.prioridad}`);
  if (row.origen?.tipo) lines.push(`Origen: ${row.origen.tipo}${row.origen.ref ? ` (${row.origen.ref})` : ""}`);
  if (row.canal) lines.push(`Canal próximo contacto: ${row.canal}`);
  if (row.proximoPaso?.accion) {
    lines.push(`Próximo paso: ${row.proximoPaso.accion}${row.proximoPaso.fecha ? ` el ${row.proximoPaso.fecha}` : ""}`);
  }
  if (row.estado === "frio") lines.push("En la oficina estaba \"frío\": no respondió; no volver a escribir.");
  if (row.id) lines.push(`ID oficina: ${row.id}`);
  return lines.join("\n");
}

/** Fuente obligatoria: dónde se vio el contacto. Sin dato de contacto basta el origen del hallazgo. */
function resolveFuente(row: OfficeRow, hasContact: boolean): string | null {
  const fuente = row.fuenteContacto?.trim();
  if (fuente) return `${fuente} (oficina de agentes)`;
  if (hasContact) return null;
  const tipo = row.origen?.tipo?.trim();
  return tipo ? `Oficina de agentes · ${tipo}${row.origen?.ref ? ` (${row.origen.ref})` : ""}` : null;
}

type MapResult = { ok: true; candidate: ImportCandidate } | { ok: false; reason: string };

function mapRow(raw: unknown): MapResult {
  const parsed = officeRowSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Fila inválida" };
  const row = parsed.data;

  const estado = STATE_MAP[row.estado ?? "nuevo"];
  if (!estado) return { ok: false, reason: `Estado desconocido: "${row.estado}"` };

  const contacto = row.contacto?.trim() ?? "";
  const email = contacto && isEmail(contacto) ? contacto : "";
  const phone = contacto && !email && isPhone(contacto) ? contacto : "";
  if (contacto && !email && !phone) return { ok: false, reason: "Contacto que no es correo ni teléfono" };

  const fuente = resolveFuente(row, Boolean(contacto));
  if (!fuente) return { ok: false, reason: "Sin fuente del contacto (fuenteContacto)" };

  const result = prospectSchema.safeParse({
    nombre: row.negocio,
    rubro: row.rubro ?? "",
    comuna: row.comuna ?? "",
    web: row.web ?? "",
    instagram: row.instagram ?? "",
    email_publico: email,
    telefono_publico: phone,
    fuente,
    estado,
    producto_sugerido: ["marca-web", "contenido", "crecimiento"].includes(row.productoSugerido ?? "")
      ? row.productoSugerido
      : "",
    notas: buildNotes(row),
    ultimo_contacto: lastContactDate(row),
  });
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, reason: `${issue?.path[0] ?? "fila"}: ${issue?.message ?? "inválido"}` };
  }
  return { ok: true, candidate: { values: result.data, officeId: row.id ?? null } };
}

function rowLabel(raw: unknown, index: number): string {
  if (raw && typeof raw === "object") {
    const r = raw as { negocio?: unknown; id?: unknown };
    if (typeof r.negocio === "string" && r.negocio.trim()) return r.negocio.trim();
    if (typeof r.id === "string" && r.id.trim()) return r.id.trim();
  }
  return `Fila ${index + 1}`;
}

/** Valida, mapea y deduplica (nombre+comuna o email) contra la BD y dentro del mismo archivo. */
export function planImport(rows: readonly unknown[], existing: readonly ExistingProspect[]): ImportPlan {
  const seenKeys = new Set(existing.map((p) => dedupeKey(p.nombre, p.comuna)));
  const seenEmails = new Set(
    existing.map((p) => p.email_publico?.toLowerCase()).filter((e): e is string => Boolean(e)),
  );
  const toInsert: ImportCandidate[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((raw, index) => {
    const label = rowLabel(raw, index);
    const mapped = mapRow(raw);
    if (!mapped.ok) {
      skipped.push({ index, label, reason: mapped.reason });
      return;
    }
    const { values } = mapped.candidate;
    const key = dedupeKey(values.nombre, values.comuna);
    const email = values.email_publico;
    if (seenKeys.has(key)) {
      skipped.push({ index, label, reason: "Duplicado: mismo nombre y comuna" });
      return;
    }
    if (email && seenEmails.has(email)) {
      skipped.push({ index, label, reason: "Duplicado: mismo correo" });
      return;
    }
    seenKeys.add(key);
    if (email) seenEmails.add(email);
    toInsert.push(mapped.candidate);
  });

  return { toInsert, skipped, total: rows.length };
}
