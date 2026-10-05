import { useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { periodLabel } from "@/lib/billing/dates";
import {
  FEW_BUSINESS_DAYS,
  businessDays,
  isDuplicate,
  monthBounds,
  summarizeExisting,
  type ExistingTask,
  type MonthPlanItem,
} from "@/lib/delivery/monthPlan";
import { createMonthTasks, useExistingMonthTasks } from "./monthPlanQueries";

const TITLE_MAX = 200;
const NO_TASKS: readonly ExistingTask[] = [];

interface Row {
  readonly item: MonthPlanItem;
  readonly include: boolean;
  readonly title: string;
  readonly dueDate: string;
}

interface MonthPlanDialogProps {
  clientId: string;
  userKey: string;
  month: string;
  /** Hoy en Chile ("YYYY-MM-DD"). */
  today: string;
  planLabel: string;
  items: readonly MonthPlanItem[];
  onClose: () => void;
  onCreated: () => void;
}

function toDraft(row: Row): MonthPlanItem {
  return { ...row.item, title: row.title.trim(), dueDate: row.dueDate };
}

/** Vista previa editable: el dueño desmarca, renombra o mueve fechas antes de crear. */
export function MonthPlanDialog({
  clientId,
  userKey,
  month,
  today,
  planLabel,
  items,
  onClose,
  onCreated,
}: MonthPlanDialogProps) {
  const existing = useExistingMonthTasks(userKey, clientId, month, true);
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((item) => ({ item, include: true, title: item.title, dueDate: item.dueDate })),
  );
  const [saving, setSaving] = useState(false);
  // Evita doble envío (doble clic o Enter) antes de que `saving` se pinte.
  const inFlight = useRef(false);
  const { first, last } = monthBounds(month);
  const minDate = today > first ? today : first;
  const remainingDays = useMemo(() => businessDays(month, today).length, [month, today]);
  const label = periodLabel(`${month}-01`);

  const existingRows = existing.data ?? NO_TASKS;
  const summary = useMemo(() => summarizeExisting(month, existingRows), [month, existingRows]);
  const duplicateKeys = useMemo(
    () =>
      new Set(
        rows.filter((r) => isDuplicate(toDraft(r), month, existingRows)).map((r) => r.item.key),
      ),
    [rows, month, existingRows],
  );
  const toCreate = rows.filter(
    (r) =>
      r.include &&
      !duplicateKeys.has(r.item.key) &&
      r.title.trim() &&
      r.dueDate >= minDate &&
      r.dueDate <= last,
  );

  const patch = (key: string, change: Partial<Omit<Row, "item">>) =>
    setRows((prev) => prev.map((r) => (r.item.key === key ? { ...r, ...change } : r)));

  const confirm = async () => {
    if (saving || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const res = await createMonthTasks(clientId, month, toCreate.map(toDraft));
      onCreated();
      if (res.created === 0) {
        toast.info("No se creó nada: esas tareas ya existían para este mes.");
      } else {
        const skipped = res.skipped > 0 ? ` (${res.skipped} ya existían)` : "";
        toast.success(`Se crearon ${res.created} tareas para ${label}${skipped}.`);
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "No se pudieron crear las tareas");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Plan del mes · <span className="capitalize">{label}</span>
          </DialogTitle>
          <DialogDescription>
            {planLabel}. Revisa, edita o desmarca antes de crear. Se guardan como tareas internas
            «Por hacer»: no se publica nada ni se envía al cliente.
          </DialogDescription>
        </DialogHeader>

        {existing.isLoading ? (
          <ListSkeleton rows={5} label="Revisando tareas del mes" />
        ) : existing.error ? (
          <ErrorState
            message={existing.error.message}
            onRetry={() => void existing.refetch()}
            retrying={existing.isFetching}
          />
        ) : (
          <>
            {remainingDays < FEW_BUSINESS_DAYS && (
              <p
                role="status"
                className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground"
              >
                Quedan pocos días hábiles este mes ({remainingDays}). Las cantidades se ajustaron a
                los días que quedan; revisa si conviene generar el mes siguiente.
              </p>
            )}
            {summary.total > 0 && (
              <div
                role="status"
                className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
              >
                <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p>
                  Este mes ya tiene {summary.total} {summary.total === 1 ? "tarea" : "tareas"}
                  {summary.fromPlan > 0 ? ` (${summary.fromPlan} del plan del mes)` : ""}. Las
                  repetidas se marcan y no se vuelven a crear.
                </p>
              </div>
            )}
            <ul className="divide-y rounded-md border">
              {rows.map((row) => {
                const dup = duplicateKeys.has(row.item.key);
                return (
                  <li
                    key={row.item.key}
                    className={`flex flex-col gap-2 p-2 sm:flex-row sm:items-center ${dup ? "opacity-60" : ""}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Checkbox
                        checked={row.include && !dup}
                        disabled={dup}
                        onCheckedChange={(v) => patch(row.item.key, { include: v === true })}
                        aria-label={`Incluir ${row.title}`}
                      />
                      <Input
                        value={row.title}
                        maxLength={TITLE_MAX}
                        disabled={dup || !row.include}
                        onChange={(e) => patch(row.item.key, { title: e.target.value })}
                        aria-label={`Título: ${row.title}`}
                        className="h-8"
                      />
                    </div>
                    <div className="flex items-center gap-2 pl-6 sm:pl-0">
                      <Input
                        type="date"
                        value={row.dueDate}
                        min={minDate}
                        max={last}
                        disabled={dup || !row.include}
                        onChange={(e) => patch(row.item.key, { dueDate: e.target.value })}
                        aria-label={`Fecha de ${row.title}`}
                        className="h-8 w-[150px]"
                      />
                      {dup && <span className="text-xs text-muted-foreground">Ya creada</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={confirm}
            disabled={
              saving || existing.isLoading || Boolean(existing.error) || toCreate.length === 0
            }
          >
            {saving ? (
              <span role="status">Creando…</span>
            ) : (
              `Crear ${toCreate.length} ${toCreate.length === 1 ? "tarea" : "tareas"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
