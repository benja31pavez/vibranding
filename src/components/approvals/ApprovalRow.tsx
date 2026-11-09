import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Check,
  ExternalLink,
  FileText,
  Instagram,
  MessageSquareWarning,
  PackageCheck,
  X,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalAction } from "@/hooks/use-approval-queue";
import type { ApprovalItem, ApprovalKind } from "@/lib/approvals";

const KIND_ICON: Record<ApprovalKind, ComponentType<{ className?: string }>> = {
  entregable: PackageCheck,
  post_instagram: Instagram,
  propuesta: FileText,
};

/** El ícono ya distingue el tipo: en el contexto basta la palabra corta. */
const KIND_SHORT: Record<ApprovalKind, string> = {
  entregable: "Entregable",
  post_instagram: "Post",
  propuesta: "Propuesta",
};

/** Botones compactos: Aprobar, Cambios, Rechazar y abrir caben en una línea en una columna. */
const ACTION_BTN = "h-8 gap-1 px-2 text-xs";

interface ApprovalRowProps {
  item: ApprovalItem;
  /** Contexto secundario: lo que el grupo o filtro actual no dice ya. */
  showClient: boolean;
  showKind: boolean;
  onAction: (action: ApprovalAction) => void;
}

type ActionProps = Pick<ApprovalRowProps, "item" | "onAction">;

function relativeDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

/**
 * Fila de la bandeja (FitList pone el `<li>`). Usa container queries: en una columna
 * angosta las acciones bajan bajo el título; en una ancha quedan a la derecha.
 */
export function ApprovalRow({ item, showClient, showKind, onAction }: ApprovalRowProps) {
  const Icon = KIND_ICON[item.kind];
  const context = [
    showClient ? item.clientName : null,
    showKind ? KIND_SHORT[item.kind] : null,
    relativeDate(item.createdAt),
  ].filter(Boolean);

  return (
    <div className="@container py-3">
      <div className="flex flex-col gap-2.5 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-app-md bg-surface-2 text-muted-foreground">
            <Icon aria-hidden className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground" title={item.title}>
              {item.title}
            </p>
            {context.length > 0 && (
              <p className="text-xs text-muted-foreground">{context.join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 @md:pl-11 @xl:shrink-0 @xl:justify-end @xl:pl-0">
          <RowActions item={item} onAction={onAction} />
        </div>
      </div>
    </div>
  );
}

function RowActions({ item, onAction }: ActionProps) {
  switch (item.kind) {
    case "entregable":
      return (
        <>
          <Button
            size="sm"
            className={ACTION_BTN}
            aria-label={`Aprobar ${item.title}`}
            onClick={() => onAction({ type: "deliverable_approve", item })}
          >
            <Check aria-hidden className="h-3.5 w-3.5" /> Aprobar
          </Button>
          <RequestChangesButton item={item} onAction={onAction} />
          <OpenLink item={item} />
        </>
      );
    case "post_instagram":
      return (
        <>
          <Button
            size="sm"
            className={ACTION_BTN}
            aria-label={`Aprobar ${item.title}`}
            onClick={() => onAction({ type: "instagram_decision", item, decision: "aprobado" })}
          >
            <Check aria-hidden className="h-3.5 w-3.5" /> Aprobar
          </Button>
          <Button
            size="sm"
            className={ACTION_BTN}
            variant="outline"
            aria-label={`Pedir cambios a ${item.title}`}
            onClick={() => onAction({ type: "instagram_decision", item, decision: "cambios" })}
          >
            <MessageSquareWarning aria-hidden className="h-3.5 w-3.5" /> Cambios
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              ACTION_BTN,
              "text-danger-strong hover:bg-danger-subtle hover:text-danger-strong",
            )}
            aria-label={`Rechazar ${item.title}`}
            onClick={() => onAction({ type: "instagram_decision", item, decision: "rechazado" })}
          >
            <X aria-hidden className="h-3.5 w-3.5" /> Rechazar
          </Button>
          <OpenLink item={item} />
        </>
      );
    case "propuesta":
      return <OpenProposalButton item={item} />;
  }
}

function RequestChangesButton({ item, onAction }: ActionProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const submit = () => {
    onAction({ type: "deliverable_changes", item, note });
    setOpen(false);
    setNote("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={ACTION_BTN}
          aria-label={`Pedir cambios a ${item.title}`}
        >
          <MessageSquareWarning aria-hidden className="h-3.5 w-3.5" /> Cambios
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 space-y-2"
        aria-label={`Pedir cambios a ${item.title}`}
      >
        <label htmlFor={`changes-${item.refId}`} className="text-sm font-medium">
          ¿Qué hay que cambiar?
        </label>
        <Textarea
          id={`changes-${item.refId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opcional: describe los cambios para el equipo"
          rows={3}
          maxLength={2000}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={submit}>
            Enviar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OpenLink({ item }: { item: ApprovalItem }) {
  if (!item.clientId) return null;
  const label = `Abrir ${item.title}`;
  if (item.kind === "entregable") {
    return (
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-7 text-muted-foreground hover:text-foreground"
        title={label}
        asChild
      >
        <Link
          to="/clients/$clientId/plan"
          params={{ clientId: item.clientId }}
          search={{ tab: "resumen" }}
          aria-label={label}
        >
          <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  }
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-7 text-muted-foreground hover:text-foreground"
      title={label}
      asChild
    >
      <Link
        to="/clients/$clientId/instagram"
        params={{ clientId: item.clientId }}
        search={{ tab: "publicaciones" }}
        aria-label={label}
      >
        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}

/** Abre el editor de la propuesta en borrador (/proposals/$proposalId). */
function OpenProposalButton({ item }: { item: ApprovalItem }) {
  return (
    <Button size="sm" variant="outline" className={ACTION_BTN} asChild>
      <Link
        to="/proposals/$proposalId"
        params={{ proposalId: item.refId }}
        aria-label={`Abrir ${item.title}`}
      >
        <ExternalLink aria-hidden className="h-3.5 w-3.5" /> Abrir propuesta
      </Link>
    </Button>
  );
}
