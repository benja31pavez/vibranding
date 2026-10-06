import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PartialErrorNoticeProps {
  labels: string[];
  retrying: boolean;
  onRetry: () => void;
}

/** Aviso cuando algunas fuentes fallaron pero el resto del calendario sí cargó. */
export function PartialErrorNotice({ labels, retrying, onRetry }: PartialErrorNoticeProps) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-app-md border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-warning-strong"
    >
      <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        No pudimos cargar: {labels.join(", ")}. El resto de la agenda está al día.
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={onRetry}
        disabled={retrying}
      >
        <RotateCw aria-hidden className={`mr-1 h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
        Reintentar
      </Button>
    </div>
  );
}
