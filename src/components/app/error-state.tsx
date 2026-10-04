import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  /** Mensaje legible; evita mostrar trazas internas. */
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** Error visible con opción de reintentar. Se anuncia a lectores de pantalla (role="alert"). */
export function ErrorState({
  title = "No pudimos cargar esta información",
  message,
  onRetry,
  retrying,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-app-lg border border-danger/30 bg-danger-subtle p-4",
        className,
      )}
    >
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger-strong" />
      <div className="min-w-[12rem] flex-1">
        <p className="text-sm font-medium text-danger-strong">{title}</p>
        {message && <p className="mt-0.5 break-words text-sm text-foreground/80">{message}</p>}
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
          className="shrink-0 bg-surface"
        >
          <RotateCw aria-hidden className={cn("mr-1.5 h-3.5 w-3.5", retrying && "animate-spin")} />
          Reintentar
        </Button>
      )}
    </div>
  );
}
