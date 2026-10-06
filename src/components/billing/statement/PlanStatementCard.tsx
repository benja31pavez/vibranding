import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { BarePanelProvider, ErrorState, ListSkeleton, Money, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BillingCard } from "@/components/clients/ficha/BillingCard";
import { useFichaOverview } from "@/components/clients/ficha/fichaQueries";
import { formatMoney } from "@/lib/pricing/plans";
import { fmtDay } from "./format";
import type { AccountStanding, NextCharge, PlanView } from "./statementData";

const STANDING: Readonly<
  Record<AccountStanding, { label: string; tone: "success" | "warning" | "danger" }>
> = {
  al_dia: { label: "Al día", tone: "success" },
  por_pagar: { label: "Por pagar", tone: "warning" },
  vencido: { label: "Vencido", tone: "danger" },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-nowrap text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

export interface PlanStatementCardProps {
  clientId: string;
  view: PlanView | null;
  next: NextCharge | null;
  standing: AccountStanding | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Solo agencia con permiso de edición. */
  canEdit: boolean;
  onPlanSaved: () => void;
}

/** "Tu plan": lo que el cliente contrató y cuándo paga. Sin MRR ni datos internos. */
export function PlanStatementCard({
  clientId,
  view,
  next,
  standing,
  loading,
  error,
  onRetry,
  canEdit,
  onPlanSaved,
}: PlanStatementCardProps) {
  const [editing, setEditing] = useState(false);
  const status = standing ? STANDING[standing] : null;

  return (
    <section
      aria-labelledby="tu-plan"
      className="flex min-w-0 flex-col gap-3 rounded-app-lg border border-l-4 border-border-subtle bg-surface p-5 shadow-app-xs"
      style={{ borderLeftColor: "var(--brand-2)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            id="tu-plan"
            className="text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--brand-2)" }}
          >
            Tu plan
          </p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-40" />
          ) : (
            <h2 className="truncate text-lg font-semibold">{view?.label ?? "Sin plan activo"}</h2>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status && !loading && (
            <StatusBadge status={standing ?? ""} label={status.label} tone={status.tone} />
          )}
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} label="Cargando plan" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <PlanRows view={view} next={next} />
      )}

      {canEdit && (
        <div className="-mb-1 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden className="mr-1 h-3.5 w-3.5" />
            Editar plan
          </Button>
        </div>
      )}

      {canEdit && (
        <Sheet
          open={editing}
          onOpenChange={(open) => {
            setEditing(open);
            if (!open) onPlanSaved();
          }}
        >
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b px-6 pb-3 pt-6 text-left">
              <SheetTitle>Editar plan</SheetTitle>
              <SheetDescription className="sr-only">
                Plan, día de cobro, fecha de inicio y estado comercial del cliente.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {editing && <PlanEditor clientId={clientId} />}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}

function PlanRows({ view, next }: { view: PlanView | null; next: NextCharge | null }) {
  if (!view?.label) {
    return <p className="text-sm text-muted-foreground">Aún no hay un plan contratado.</p>;
  }
  const period = view.monthly ? "/mes" : " (pago único)";
  return (
    <dl className="divide-y divide-border-subtle">
      {view.net !== null && view.total !== null && (
        <Row label="Precio">
          <span className="tabular-nums">
            {formatMoney(view.net)} + IVA{period}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            Total con IVA <Money amount={view.total} className="text-foreground" />
          </span>
        </Row>
      )}
      {view.clientSince && <Row label="Cliente desde">{fmtDay(view.clientSince)}</Row>}
      {view.commitment && (
        <Row label="Permanencia">
          {view.commitment.months} meses · hasta el {fmtDay(view.commitment.until)}
        </Row>
      )}
      <Row label="Próximo cobro">
        {next ? (
          <>
            {fmtDay(next.date)} · <Money amount={next.amount} />
          </>
        ) : (
          <span className="font-normal text-muted-foreground">Sin cobros programados</span>
        )}
      </Row>
    </dl>
  );
}

/** Formulario de la agencia (el mismo de la gestión del cliente), dentro del panel lateral. */
function PlanEditor({ clientId }: { clientId: string }) {
  const overview = useFichaOverview(clientId);
  if (overview.isPending) return <Skeleton className="h-64 w-full" />;
  if (overview.error || !overview.data) {
    return (
      <ErrorState
        message={overview.error?.message ?? "No pudimos cargar el plan."}
        onRetry={() => overview.refetch()}
      />
    );
  }
  return (
    <BarePanelProvider>
      <BillingCard clientId={clientId} overview={overview.data} />
    </BarePanelProvider>
  );
}
