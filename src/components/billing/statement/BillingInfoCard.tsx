import { CheckCircle2, Copy, Link2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { EmptyState, ErrorState, ListSkeleton, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { useClientIntake } from "@/components/clients/ficha/OnboardingIntakePanel";
import { copyText } from "@/lib/billing/clientContact";
import { formatRut, isValidRut } from "@/lib/rut";

/**
 * Datos del cliente para facturación: razón social, RUT, giro y correo DTE.
 * Si falta, EmptyState con el link de onboarding (o enlace a Configuración de
 * la ficha, donde se genera el link). Solo visible para la agencia.
 */
export function BillingInfoCard({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const intake = useClientIntake(clientId, canEdit);

  if (!canEdit) {
    return null;
  }

  const data = intake.data;
  const prettyRut = data?.rut ? (isValidRut(data.rut) ? formatRut(data.rut) : data.rut) : null;
  const missing = computeMissing(data);

  const copyAll = async () => {
    if (!data) return;
    const lines = [
      data.razon_social ? `Razón social: ${data.razon_social}` : null,
      prettyRut ? `RUT: ${prettyRut}` : null,
      data.giro ? `Giro: ${data.giro}` : null,
      data.email_facturacion ? `Correo DTE: ${data.email_facturacion}` : null,
      data.direccion ? `Dirección: ${data.direccion}` : null,
    ].filter(Boolean);
    const text = lines.join("\n");
    const ok = await copyText(text);
    toast[ok ? "success" : "error"](ok ? "Datos copiados" : "No se pudo copiar; cópialos a mano.");
  };

  return (
    <Panel
      title="Datos para facturación"
      icon={ReceiptText}
      description="Razón social, RUT, giro y correo para la boleta o factura."
      actions={
        data ? (
          missing.length === 0 ? (
            <StatusBadge status="done" label="Completo" />
          ) : (
            <StatusBadge status="pending" tone="warning" label={`Faltan ${missing.length}`} />
          )
        ) : null
      }
    >
      {intake.isLoading ? (
        <ListSkeleton rows={4} label="Cargando datos de facturación" />
      ) : intake.error ? (
        <ErrorState
          message={intake.error.message}
          onRetry={() => void intake.refetch()}
          retrying={intake.isFetching}
        />
      ) : !data ? (
        <EmptyState
          size="compact"
          icon={ReceiptText}
          title="Aún no tenemos los datos del cliente"
          description="Comparte el link de onboarding para que complete razón social, RUT, giro y correo de facturación."
          action={
            <Link
              to="/clients/$clientId/ficha"
              params={{ clientId }}
              search={{ tab: "configuracion" }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Link2 aria-hidden className="h-3 w-3" />
              Generar link de onboarding
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <InfoRow label="Razón social" value={data.razon_social} />
            <InfoRow label="RUT" value={prettyRut} warn={data.rut && !isValidRut(data.rut)} />
            <InfoRow label="Giro" value={data.giro} />
            <InfoRow label="Correo DTE" value={data.email_facturacion} />
            <InfoRow label="Dirección" value={data.direccion} />
          </dl>
          {data.rut && !isValidRut(data.rut) && (
            <p className="text-xs text-warning-strong">
              El RUT guardado no pasa la validación del dígito verificador. Revísalo con el cliente.
            </p>
          )}
          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Falta{missing.length === 1 ? "" : "n"}: {missing.join(", ")}. Pídele al cliente que
              complete sus datos con el link de onboarding.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyAll()}>
              <Copy aria-hidden className="mr-1 h-4 w-4" />
              Copiar datos
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function InfoRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | null | undefined;
  warn?: string | null | boolean;
}) {
  const shown = value?.trim() || "—";
  const missing = !value || !value.trim();
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          missing
            ? "truncate text-sm text-muted-foreground"
            : warn
              ? "truncate text-sm font-medium text-warning-strong"
              : "truncate text-sm font-medium text-foreground"
        }
        title={!missing ? shown : undefined}
      >
        {!missing && (
          <CheckCircle2 aria-hidden className="mr-1 inline h-3 w-3 text-success-strong" />
        )}
        {shown}
      </dd>
    </div>
  );
}

function computeMissing(
  data:
    | {
        razon_social: string;
        rut: string | null;
        giro: string | null;
        email_facturacion: string | null;
      }
    | null
    | undefined,
): string[] {
  if (!data) return [];
  const missing: string[] = [];
  if (!data.razon_social?.trim()) missing.push("razón social");
  if (!data.rut?.trim()) missing.push("RUT");
  if (!data.giro?.trim()) missing.push("giro");
  if (!data.email_facturacion?.trim()) missing.push("correo DTE");
  return missing;
}
