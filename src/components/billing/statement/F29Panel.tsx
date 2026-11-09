import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Info } from "lucide-react";
import { EmptyState, InfoHint, ListSkeleton, Money, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { useClientIntake } from "@/components/clients/ficha/OnboardingIntakePanel";
import {
  f29CsvFilename,
  f29CsvForPeriod,
  groupByF29Period,
  type F29Payment,
  type F29Period,
} from "@/lib/finance/f29";
import { fmtMonth } from "./format";
import type { StatementPayment } from "./statementData";

interface F29PanelProps {
  clientId: string;
  payments: readonly StatementPayment[];
  loading: boolean;
  /** `true` si el usuario puede ver los datos tributarios del cliente (intake). */
  canEdit: boolean;
}

function toF29Payment(p: StatementPayment): F29Payment {
  return {
    id: p.id,
    // Base del período: `paid_at` si está pagado, si no `due_date` (lo emitido).
    date: p.paid_at ?? p.due_date,
    description: p.description,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    document_type: p.document_type,
    folio: null,
  };
}

function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Liberar la URL en el siguiente tick para no cortar la descarga en Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Panel F29 (IVA mensual): para cada mes con datos, muestra IVA débito,
 * crédito (hoy 0 porque no cargamos compras), total estimado y botón para
 * bajar el CSV listo para transcribir al SII.
 *
 * Es herramienta de APOYO: la declaración oficial se hace en sii.cl.
 */
export function F29Panel({ clientId, payments, loading, canEdit }: F29PanelProps) {
  const intake = useClientIntake(clientId, canEdit);
  const periods = useMemo(() => groupByF29Period(payments.map(toF29Payment)), [payments]);

  const ctx = {
    rut: intake.data?.rut?.trim() || null,
    razonSocial: intake.data?.razon_social?.trim() || null,
  };

  const [open, setOpen] = useState<string | null>(() => periods[0]?.period ?? null);

  const activePeriod = useMemo(
    () => periods.find((p) => p.period === open) ?? periods[0] ?? null,
    [periods, open],
  );

  return (
    <Panel
      title="Formulario 29 (IVA mensual)"
      icon={FileSpreadsheet}
      description="Apoyo para transcribir al F29 en sii.cl; la declaración oficial se hace allá."
      actions={
        <InfoHint label="Cómo se calcula el IVA">
          Los montos de los cobros se guardan con IVA incluido. El neto y el IVA se derivan
          dividiendo por 1,19. Si quieres el valor exacto, revísalo contra tu boleta o factura
          emitida.
        </InfoHint>
      }
    >
      {loading ? (
        <ListSkeleton rows={3} label="Cargando F29" />
      ) : periods.length === 0 ? (
        <EmptyState
          size="compact"
          icon={FileSpreadsheet}
          title="Aún no hay pagos para declarar"
          description="Cuando el cliente tenga cobros pagados o emitidos aparecerán agrupados por mes, listos para el F29."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Meses tributarios">
            {periods.map((p) => (
              <button
                key={p.period}
                type="button"
                role="tab"
                aria-selected={p.period === activePeriod?.period}
                onClick={() => setOpen(p.period)}
                className={
                  p.period === activePeriod?.period
                    ? "rounded-app-sm bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-app-sm border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-2"
                }
              >
                {fmtMonth(p.monthStart)}
              </button>
            ))}
          </div>
          {activePeriod && (
            <F29PeriodView
              period={activePeriod}
              rut={ctx.rut}
              razonSocial={ctx.razonSocial}
              intakeLoading={canEdit && intake.isLoading}
            />
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Esta es una herramienta de apoyo: la declaración oficial se hace en sii.cl.</span>
          </p>
        </div>
      )}
    </Panel>
  );
}

function F29PeriodView({
  period,
  rut,
  razonSocial,
  intakeLoading,
}: {
  period: F29Period;
  rut: string | null;
  razonSocial: string | null;
  intakeLoading: boolean;
}) {
  const download = () => {
    const csv = f29CsvForPeriod(period, { rut, razonSocial });
    triggerCsvDownload(csv, f29CsvFilename(period));
  };

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-2 rounded-app-md border border-border-subtle bg-surface-2 p-3 md:grid-cols-3">
        <StatBlock label="IVA débito fiscal" value={period.debit} tone="default" />
        <StatBlock
          label="IVA crédito fiscal"
          value={period.credit}
          tone="muted"
          hint="Se activa cuando cargues tus compras del mes."
        />
        <StatBlock
          label="Total a pagar al SII (estimado)"
          value={period.owed}
          tone={period.owed > 0 ? "warning" : "default"}
        />
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="text-muted-foreground">
          {period.rows.length} {period.rows.length === 1 ? "cobro" : "cobros"} · Base imponible{" "}
          <Money amount={period.netTotal} className="text-foreground" /> · Total con IVA{" "}
          <Money amount={period.grossTotal} className="text-foreground" />
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={download}
          disabled={intakeLoading}
          aria-label={`Descargar CSV de ${fmtMonth(period.monthStart)}`}
        >
          <Download aria-hidden className="mr-1 h-4 w-4" />
          Descargar CSV
        </Button>
      </div>
      {!rut && !intakeLoading && (
        <p className="text-xs text-muted-foreground">
          Falta el RUT del cliente: el CSV se baja igual, pero la columna RUT queda vacía. Pídele
          que complete sus datos tributarios en el link de onboarding.
        </p>
      )}
      <F29RowsTable period={period} />
      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">IVA crédito fiscal:</strong> se activa cuando cargues
        tus compras del mes; por ahora aquí solo aparece el IVA de los pagos que nos emitiste.
      </p>
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "default" | "warning" | "muted";
  hint?: string;
}) {
  const valueCls =
    tone === "warning"
      ? "text-warning-strong"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`text-base font-semibold ${valueCls}`}>
        <Money amount={value} />
      </dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function F29RowsTable({ period }: { period: F29Period }) {
  if (period.rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="border-b border-border-subtle text-left text-muted-foreground">
            <th className="py-1.5 pr-3 font-medium">Fecha</th>
            <th className="py-1.5 pr-3 font-medium">Documento</th>
            <th className="py-1.5 pr-3 text-right font-medium">Neto</th>
            <th className="py-1.5 pr-3 text-right font-medium">IVA</th>
            <th className="py-1.5 pr-3 text-right font-medium">Total</th>
            <th className="py-1.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {period.rows.map((r) => (
            <tr key={r.id} className="border-b border-border-subtle last:border-b-0">
              <td className="py-1.5 pr-3 text-foreground">{r.date ?? "—"}</td>
              <td className="py-1.5 pr-3 text-foreground">
                {r.document_type ? capitalize(r.document_type) : "Sin doc."}
              </td>
              <td className="py-1.5 pr-3 text-right text-foreground">
                <Money amount={r.net} />
              </td>
              <td className="py-1.5 pr-3 text-right text-foreground">
                <Money amount={r.iva} />
              </td>
              <td className="py-1.5 pr-3 text-right text-foreground">
                <Money amount={r.amount} />
              </td>
              <td className="py-1.5">
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
