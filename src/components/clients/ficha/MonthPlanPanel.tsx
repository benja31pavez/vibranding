import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Sparkles } from "lucide-react";
import { Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findPlan } from "@/lib/pricing/plans";
import { periodLabel } from "@/lib/billing/dates";
import { chileToday } from "@/lib/dates/chile";
import { buildMonthPlan, nextMonth } from "@/lib/delivery/monthPlan";
import { useUserKey } from "./fichaQueries";
import { MonthPlanDialog } from "./MonthPlanDialog";
import { invalidateAfterMonthPlan } from "./monthPlanQueries";

interface MonthPlanPanelProps {
  clientId: string;
  planKey: string | null;
  canEdit: boolean;
}

/** "Generar plan del mes": arma las tareas internas del mes según el plan del cliente. */
export function MonthPlanPanel({ clientId, planKey, canEdit }: MonthPlanPanelProps) {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  const plan = findPlan(planKey);
  const today = chileToday();
  const months = useMemo(() => {
    const current = today.slice(0, 7);
    return [current, nextMonth(current)];
  }, [today]);
  const [month, setMonth] = useState(months[0]);
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => (plan ? buildMonthPlan({ planKey: plan.key, month, today }) : []),
    [plan, month, today],
  );

  if (!canEdit) return null;

  return (
    <Panel
      title="Plan del mes"
      icon={CalendarRange}
      description="Tareas internas del mes según el plan del cliente. No se publica nada ni se avisa al cliente."
    >
      {!plan ? (
        <p className="text-sm text-muted-foreground">
          Este cliente aún no tiene un plan asignado. Asígnalo en «Plan y facturación» para generar
          su plan del mes.
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{plan.label}</span> · {items.length}{" "}
            tareas sugeridas
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9 w-[170px]" aria-label="Mes del plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className="capitalize">{periodLabel(`${m}-01`)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setOpen(true)} disabled={items.length === 0}>
              <Sparkles aria-hidden className="mr-1 h-3.5 w-3.5" /> Generar plan del mes
            </Button>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Las tareas quedan en{" "}
        <Link
          to="/clients/$clientId/plan"
          params={{ clientId }}
          search={{ tab: "tareas" }}
          className="text-primary hover:underline"
        >
          Plan › Tareas
        </Link>{" "}
        y en la Agenda, como «Por hacer».
      </p>
      {plan && open && (
        <MonthPlanDialog
          clientId={clientId}
          userKey={userKey}
          month={month}
          today={today}
          planLabel={plan.label}
          items={items}
          onClose={() => setOpen(false)}
          onCreated={() => void invalidateAfterMonthPlan(queryClient, userKey, clientId)}
        />
      )}
    </Panel>
  );
}
