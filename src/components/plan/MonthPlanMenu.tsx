import { useMemo } from "react";
import { CalendarRange, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MonthPlanDialog } from "@/components/clients/ficha/MonthPlanDialog";
import { periodLabel } from "@/lib/billing/dates";
import { buildMonthPlan, nextMonth } from "@/lib/delivery/monthPlan";
import { toMonthPlanKey } from "@/lib/delivery/planStages";

export interface MonthPlanMenuProps {
  planKey: string | null;
  planLabel: string;
  canEdit: boolean;
  today: string;
  onPick: (month: string) => void;
}

/** "Generar plan del mes": elige este mes o el siguiente y abre la vista previa. */
export function MonthPlanMenu({ planKey, planLabel, canEdit, today, onPick }: MonthPlanMenuProps) {
  const plan = toMonthPlanKey(planKey);
  const current = today.slice(0, 7);
  const months = [current, nextMonth(current)];
  const disabledReason = !canEdit
    ? "No tienes permisos para editar este cliente."
    : !plan
      ? "Asigna un plan en la ficha del cliente para generar el plan del mes."
      : null;
  if (disabledReason) {
    return (
      <Button variant="outline" disabled title={disabledReason}>
        <Sparkles aria-hidden className="mr-1 h-4 w-4" /> Generar plan del mes
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Sparkles aria-hidden className="mr-1 h-4 w-4" /> Generar plan del mes
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarRange aria-hidden className="h-3.5 w-3.5" /> {planLabel}
        </DropdownMenuLabel>
        {months.map((m) => (
          <DropdownMenuItem key={m} onSelect={() => onPick(m)} className="capitalize">
            {periodLabel(`${m}-01`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface MonthPlanDialogHostProps {
  clientId: string;
  userKey: string;
  planKey: string | null;
  planLabel: string;
  month: string;
  today: string;
  onClose: () => void;
  onCreated: () => void;
}

/** Arma las tareas del mes con el mismo plan que define las etapas y abre el diálogo existente. */
export function MonthPlanDialogHost({
  clientId,
  userKey,
  planKey,
  planLabel,
  month,
  today,
  onClose,
  onCreated,
}: MonthPlanDialogHostProps) {
  const key = toMonthPlanKey(planKey);
  const items = useMemo(
    () => (key ? buildMonthPlan({ planKey: key, month, today }) : []),
    [key, month, today],
  );
  if (!key) return null;
  return (
    <MonthPlanDialog
      clientId={clientId}
      userKey={userKey}
      month={month}
      today={today}
      planLabel={planLabel}
      items={items}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}
