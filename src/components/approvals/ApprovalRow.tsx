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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ApprovalAction } from "@/hooks/use-approval-queue";
import { APPROVAL_KIND_LABEL, type ApprovalItem, type ApprovalKind } from "@/lib/approvals";

const KIND_ICON: Record<ApprovalKind, ComponentType<{ className?: string }>> = {
  entregable: PackageCheck,
  post_instagram: Instagram,
  propuesta: FileText,
};

interface ApprovalRowProps {
  item: ApprovalItem;
  /** Qué mostrar como contexto secundario (el grupo ya dice el otro dato). */
  showClient: boolean;
  onAction: (action: ApprovalAction) => void;
}

type ActionProps = Pick<ApprovalRowProps, "item" | "onAction">;

function relativeDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

export function ApprovalRow({ item, showClient, onAction }: ApprovalRowProps) {
  const Icon = KIND_ICON[item.kind];
  const context = showClient ? item.clientName : APPROVAL_KIND_LABEL[item.kind];
  const when = relativeDate(item.createdAt);

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-app-md bg-surface-2 text-muted-foreground">
          <Icon aria-hidden className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground" title={item.title}>
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {context}
            {when && <> · {when}</>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
        <RowActions item={item} onAction={onAction} />
      </div>
    </li>
  );
}

function RowActions({ item, onAction }: ActionProps) {
  switch (item.kind) {
    case "entregable":
      return (
        <>
          <Button size="sm" onClick={() => onAction({ type: "deliverable_approve", item })}>
            <Check aria-hidden className="mr-1 h-3.5 w-3.5" /> Aprobar
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

            onClick={() => onAction({ type: "instagram_decision", item, decision: "aprobado" })}
          >
            <Check aria-hidden className="mr-1 h-3.5 w-3.5" /> Aprobar
          </Button>
          <Button
            size="sm"
            variant="outline"

            onClick={() => onAction({ type: "instagram_decision", item, decision: "cambios" })}
          >
            <MessageSquareWarning aria-hidden className="mr-1 h-3.5 w-3.5" /> Cambios
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger-strong hover:bg-danger-subtle hover:text-danger-strong"

            onClick={() => onAction({ type: "instagram_decision", item, decision: "rechazado" })}
          >
            <X aria-hidden className="mr-1 h-3.5 w-3.5" /> Rechazar
          </Button>
          <OpenLink item={item} />
        </>
      );
    case "propuesta":
      return <ProposalSoonButton />;
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
        <Button size="sm" variant="outline">
          <MessageSquareWarning aria-hidden className="mr-1 h-3.5 w-3.5" /> Pedir cambios
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2">
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
      <Button size="sm" variant="ghost" asChild>
        <Link
          to="/clients/$clientId/plan"
          params={{ clientId: item.clientId }}
          search={{ tab: "etapas" }}
          aria-label={label}
        >
          <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link
        to="/clients/$clientId/instagram"
        params={{ clientId: item.clientId }}
        aria-label={label}
      >
        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}

/** El editor de propuestas aún no existe: botón deshabilitado con explicación. */
function ProposalSoonButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Un botón deshabilitado no recibe eventos: el span permite mostrar el tooltip y enfocarlo. */}
        <span
          tabIndex={0}
          className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Button size="sm" variant="outline" disabled className="pointer-events-none">
            <ExternalLink aria-hidden className="mr-1 h-3.5 w-3.5" /> Abrir propuesta
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Próximamente</TooltipContent>
    </Tooltip>
  );
}
