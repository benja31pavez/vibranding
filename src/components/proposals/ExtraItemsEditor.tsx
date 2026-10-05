import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_ITEM_AMOUNT, MAX_ITEMS, type ProposalItem } from "@/lib/proposals/model";

/** Fila del editor: `uid` estable para que React no mezcle el estado al quitar filas. */
export interface ExtraRow {
  uid: string;
  item: ProposalItem;
}

interface Props {
  items: readonly ExtraRow[];
  onChange: (items: ExtraRow[]) => void;
  disabled?: boolean;
}

let rowSeq = 0;
export function toExtraRow(item: ProposalItem): ExtraRow {
  rowSeq += 1;
  return { uid: `row-${rowSeq}`, item };
}

const EMPTY_EXTRA: ProposalItem = { type: "extra", label: "", amount: 0, billing: "one_time" };

/** "1.234.567" o "-50000" → entero acotado (CLP no tiene decimales). */
function parseAmount(raw: string): number {
  const negative = raw.trim().startsWith("-");
  const digits = raw.replace(/[^0-9]/g, "");
  const value = Math.min(Number(digits || "0"), MAX_ITEM_AMOUNT);
  return negative ? -value : value;
}

/** Ítems adicionales (o descuentos con monto negativo). Montos con IVA incluido. */
export function ExtraItemsEditor({ items, onChange, disabled }: Props) {
  const update = (idx: number, patch: Partial<ProposalItem>) =>
    onChange(
      items.map((row, i) => (i === idx ? { ...row, item: { ...row.item, ...patch } } : row)),
    );
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, toExtraRow(EMPTY_EXTRA)]);

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin adicionales. Para un descuento usa un monto negativo.
        </p>
      )}
      {items.map(({ uid, item }, idx) => (
        <div
          key={uid}
          className="grid grid-cols-1 gap-2 rounded-app-md border border-border-subtle p-3 sm:grid-cols-[1fr_9rem_9rem_auto]"
        >
          <Input
            aria-label={`Descripción del ítem ${idx + 1}`}
            placeholder="Ej.: Landing adicional"
            value={item.label}
            maxLength={120}
            onChange={(e) => update(idx, { label: e.target.value })}
            disabled={disabled}
          />
          <AmountInput
            label={`Monto con IVA del ítem ${idx + 1}`}
            value={item.amount}
            onChange={(amount) => update(idx, { amount })}
            disabled={disabled}
          />
          <Select
            value={item.billing}
            onValueChange={(v) =>
              update(idx, { billing: v === "monthly" ? "monthly" : "one_time" })
            }
            disabled={disabled}
          >
            <SelectTrigger aria-label={`Tipo de cobro del ítem ${idx + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_time">Pago único</SelectItem>
              <SelectItem value="monthly">Mensual</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(idx)}
            disabled={disabled}
            aria-label={`Quitar ítem ${idx + 1}`}
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={disabled || items.length >= MAX_ITEMS - 1}
      >
        <Plus aria-hidden className="mr-1 h-3.5 w-3.5" /> Agregar ítem
      </Button>
    </div>
  );
}

const formatAmount = (n: number) => (n === 0 ? "" : n.toLocaleString("es-CL"));

/** Texto libre mientras se escribe (permite el "-" inicial); se normaliza al salir. */
function AmountInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => formatAmount(value));
  return (
    <Input
      aria-label={label}
      inputMode="text"
      className="tabular-nums"
      placeholder="$ con IVA"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
      onBlur={() => setText(formatAmount(value))}
      disabled={disabled}
    />
  );
}
