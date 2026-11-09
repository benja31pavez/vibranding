/**
 * Apoyo para el F29 mensual del cliente pyme (SII, declaración de IVA).
 *
 * Herramienta de APOYO: agrupa los pagos que la agencia le emitió al cliente
 * y les deriva el IVA. La declaración oficial se hace en sii.cl; esto solo
 * ayuda a transcribir las cifras.
 *
 * La plataforma guarda los montos de `payments.amount` SIEMPRE con IVA
 * incluido (ver `@/lib/pricing/iva`), así que el neto y el IVA se derivan con
 * `breakdownFromTotal`: `netOfTotal(withIva(n)) === n` para enteros, por lo
 * que la cifra es exacta para registros creados por la plataforma. Los
 * registros antiguos también se guardaron con IVA incluido (regla IVA
 * incluido), por lo que la misma fórmula aplica.
 */
import { breakdownFromTotal } from "@/lib/pricing/iva";

export interface F29Payment {
  id: string;
  /** Fecha del evento tributario: `paid_at` si está pagado, si no `due_date`. */
  date: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  document_type: string | null;
  /** Folio o referencia del documento tributario. */
  folio?: string | null;
}

export interface F29Row {
  id: string;
  date: string | null;
  description: string | null;
  amount: number;
  net: number;
  iva: number;
  currency: string;
  status: string;
  document_type: string | null;
  folio: string | null;
}

export interface F29Period {
  /** "YYYY-MM". */
  period: string;
  /** Primer día del mes "YYYY-MM-01" (para orden y mostrar en es-CL). */
  monthStart: string;
  rows: F29Row[];
  /** IVA débito fiscal (suma del IVA de los pagos emitidos al cliente en el período). */
  debit: number;
  /** IVA crédito fiscal: hoy siempre 0 (no cargamos compras del cliente). */
  credit: number;
  /** Total a pagar en SII estimado (débito − crédito). */
  owed: number;
  /** Neto total del período (base imponible). */
  netTotal: number;
  /** Total con IVA cobrado al cliente (debe = `netTotal + debit`). */
  grossTotal: number;
}

/**
 * Extrae el "YYYY-MM" del pago: usa `paid_at` si está, si no `due_date`,
 * si no `null` (el pago no cuenta para el F29 de ningún mes).
 */
function paymentPeriod(p: F29Payment): string | null {
  const iso = p.date;
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Solo cobros que efectivamente son parte de la base imponible del cliente pyme. */
function isTaxable(p: F29Payment): boolean {
  // Solo registros en CLP y no anulados entran al F29.
  if (p.currency && p.currency !== "CLP") return false;
  if (p.status === "cancelled") return false;
  if (!Number.isFinite(p.amount) || p.amount <= 0) return false;
  return true;
}

function toRow(p: F29Payment): F29Row {
  const { net, iva, total } = breakdownFromTotal(p.amount);
  return {
    id: p.id,
    date: p.date,
    description: p.description,
    amount: total,
    net,
    iva,
    currency: p.currency,
    status: p.status,
    document_type: p.document_type,
    folio: p.folio ?? null,
  };
}

/** Agrupa los pagos del cliente por mes tributario (orden más reciente primero). */
export function groupByF29Period(payments: readonly F29Payment[]): F29Period[] {
  const buckets = new Map<string, F29Row[]>();
  for (const p of payments) {
    if (!isTaxable(p)) continue;
    const period = paymentPeriod(p);
    if (!period) continue;
    const list = buckets.get(period) ?? [];
    list.push(toRow(p));
    buckets.set(period, list);
  }
  const periods = Array.from(buckets.entries()).map(([period, rows]): F29Period => {
    rows.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const netTotal = rows.reduce((s, r) => s + r.net, 0);
    const debit = rows.reduce((s, r) => s + r.iva, 0);
    const grossTotal = rows.reduce((s, r) => s + r.amount, 0);
    const credit = 0;
    return {
      period,
      monthStart: `${period}-01`,
      rows,
      debit,
      credit,
      owed: Math.max(0, debit - credit),
      netTotal,
      grossTotal,
    };
  });
  periods.sort((a, b) => b.period.localeCompare(a.period));
  return periods;
}

const CSV_HEADERS = [
  "Fecha",
  "RUT cliente",
  "Razón social",
  "Folio",
  "Tipo documento",
  "Neto",
  "IVA",
  "Total",
  "Estado",
] as const;

/** Escapa un valor para CSV: comillas dobles + escape de las comillas internas. */
function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export interface F29CsvContext {
  rut: string | null;
  razonSocial: string | null;
}

/** CSV de un período listo para pegar en una planilla o transcribir al F29. */
export function f29CsvForPeriod(period: F29Period, ctx: F29CsvContext): string {
  const rut = ctx.rut ?? "";
  const razon = ctx.razonSocial ?? "";
  const lines = [CSV_HEADERS.map(csvCell).join(",")];
  for (const r of period.rows) {
    lines.push(
      [
        r.date ?? "",
        rut,
        razon,
        r.folio ?? "",
        r.document_type ?? "",
        r.net,
        r.iva,
        r.amount,
        r.status,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM para que Excel abra bien los caracteres con tilde/ñ.
  const bom = String.fromCharCode(0xfeff);
  return `${bom}${lines.join("\r\n")}\r\n`;
}

/** Nombre sugerido del archivo descargado. */
export function f29CsvFilename(period: F29Period): string {
  return `f29-${period.period}.csv`;
}
