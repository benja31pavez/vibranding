import { useState, type ReactNode } from "react";
import { Eye, Pencil } from "lucide-react";
import { ErrorState, ListSkeleton, Money } from "@/components/app";
import { Button } from "@/components/ui/button";
import { chileToday } from "@/lib/dates/chile";
import { findPlan } from "@/lib/pricing/plans";
import { useFichaAccount, type FichaAccount } from "./agencyQueries";
import { BillingCard } from "./BillingCard";
import { useLatestContract } from "./ContractPanel";
import { FichaSheet } from "./FichaSheet";
import { formatDate, type FichaOverview, type useFichaOverview } from "./fichaQueries";

type Contract = ReturnType<typeof useLatestContract>["data"];

const CONTRACT_LABEL: Readonly<Record<string, string>> = {
  signed: "Vigente",
  sent: "Enviado, sin firmar",
  draft: "Borrador",
  cancelled: "Cancelado",
};

/** Próximo día de cobro (YYYY-MM-DD) a partir de hoy, según el día del mes acordado. */
function nextBillingDate(billingDay: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d <= billingDay) return `${y}-${pad(m)}-${pad(billingDay)}`;
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${next.y}-${pad(next.m)}-${pad(billingDay)}`;
}

function nextCharge(overview: FichaOverview, account: FichaAccount | undefined): string {
  const fromSubscription = account?.subscription?.next_charge_date;
  if (fromSubscription) return formatDate(fromSubscription);
  const day = overview.billing?.billing_day;
  return day ? formatDate(nextBillingDate(day, chileToday())) : "No definido";
}

function contractLabel(contract: Contract, account: FichaAccount | undefined): string {
  if (contract === undefined) return "…";
  if (!contract) return "Sin contrato";
  const label = CONTRACT_LABEL[contract.status] ?? contract.status;
  const months = account?.subscription?.min_months ?? 0;
  return contract.status === "signed" && months > 0 ? `${label} · ${months} meses` : label;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

/** "Cuenta": plan, MRR, próximo cobro, contrato y antigüedad; se edita en "Plan y facturación". */
export function AccountCard({
  clientId,
  overview,
}: {
  clientId: string;
  overview: ReturnType<typeof useFichaOverview>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const account = useFichaAccount(clientId);
  const contract = useLatestContract(clientId);
  const data = overview.data;
  const canEdit = Boolean(data?.canEdit);

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
            onClick={() => setEditOpen(true)}
          >
            {canEdit ? (
              <Pencil aria-hidden className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Eye aria-hidden className="mr-1 h-3.5 w-3.5" />
            )}
            {canEdit ? "Editar" : "Ver"}
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
          <Row label="Plan actual">{findPlan(data.billing?.plan_key)?.label ?? "Sin plan"}</Row>
          <Row label="MRR neto">
            <Money amount={data.billing?.mrr ?? 0} />
          </Row>
          <Row label="Próximo cobro">{nextCharge(data, account.data)}</Row>
          <Row label="Contrato">{contractLabel(contract.data, account.data)}</Row>
          <Row label="Cliente desde">{formatDate(data.startedAt)}</Row>
        </dl>
      ) : null}

      {data && (
        <FichaSheet open={editOpen} onOpenChange={setEditOpen} title="Plan y facturación">
          <BillingCard clientId={clientId} overview={data} />
        </FichaSheet>
      )}
    </section>
  );
}
