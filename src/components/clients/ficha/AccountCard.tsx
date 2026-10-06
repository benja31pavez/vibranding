import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { ErrorState, ListSkeleton, Money } from "@/components/app";
import { Button } from "@/components/ui/button";
import { membershipMrr, type Membership } from "@/lib/billing/membership";
import { useMembership } from "@/lib/billing/membership.functions";
import { findPlan } from "@/lib/pricing/plans";
import { BillingCard } from "./BillingCard";
import { useLatestContract } from "./ContractPanel";
import { FichaSheet } from "./FichaSheet";
import { formatDate, type useFichaOverview } from "./fichaQueries";

type Contract = ReturnType<typeof useLatestContract>["data"];

const CONTRACT_LABEL: Readonly<Record<string, string>> = {
  signed: "Vigente",
  sent: "Enviado, sin firmar",
  draft: "Borrador",
  cancelled: "Cancelado",
};

/** Hasta cuándo está pagado (sin cobros automáticos: el cliente renueva). */
function paidUntil(m: Membership | undefined): string {
  if (!m) return "…";
  if (m.state === "sin_plan") return "Sin plan vigente";
  if (m.state === "finalizado") return "Finalizado";
  return formatDate(m.coveredUntil);
}

function contractLabel(contract: Contract): string {
  if (contract === undefined) return "…";
  if (!contract) return "Sin contrato";
  return CONTRACT_LABEL[contract.status] ?? contract.status;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

/** "Cuenta": plan, MRR, vigencia, contrato y antigüedad, derivados de los pagos (solo lectura). */
export function AccountCard({
  clientId,
  overview,
}: {
  clientId: string;
  overview: ReturnType<typeof useFichaOverview>;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const membership = useMembership(clientId).data;
  const contract = useLatestContract(clientId);
  const data = overview.data;

  return (
    <section
      aria-label="Cuenta"
      className="flex min-w-0 flex-col rounded-app-lg border border-l-4 border-border-subtle bg-surface px-4 py-3.5 shadow-app-xs md:px-5"
      style={{ borderLeftColor: "var(--brand-3)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--brand-3)" }}
          >
            Cuenta
          </p>
          <h2 className="text-base font-semibold">Estado de la cuenta</h2>
        </div>
        {data && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            aria-haspopup="dialog"
            onClick={() => setDetailOpen(true)}
          >
            <Eye aria-hidden className="mr-1 h-3.5 w-3.5" />
            Ver
          </Button>
        )}
      </div>

      {overview.isLoading ? (
        <ListSkeleton rows={4} label="Cargando cuenta" />
      ) : overview.error ? (
        <ErrorState
          message={overview.error.message}
          onRetry={() => void overview.refetch()}
          retrying={overview.isFetching}
        />
      ) : data ? (
        <dl className="mt-2 flex flex-col">
          <Row label="Plan actual">
            {membership && membership.state !== "sin_plan"
              ? (findPlan(membership.planKey)?.label ?? "Sin plan")
              : "Sin plan"}
          </Row>
          <Row label="MRR neto">
            <Money amount={membership ? membershipMrr(membership) : 0} />
          </Row>
          <Row label="Pagado hasta">{paidUntil(membership)}</Row>
          <Row label="Contrato">{contractLabel(contract.data)}</Row>
          <Row label="Cliente desde">{formatDate(membership?.clientSince ?? null)}</Row>
        </dl>
      ) : null}

      {data && (
        <FichaSheet open={detailOpen} onOpenChange={setDetailOpen} title="Plan y facturación">
          <BillingCard clientId={clientId} />
        </FichaSheet>
      )}
    </section>
  );
}
