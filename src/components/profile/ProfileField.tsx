import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ProfileFieldProps {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  className?: string;
  /** Contenido dentro del input, a la derecha (p. ej. botón mostrar/ocultar). */
  trailing?: ReactNode;
}

/** Campo de texto con etiqueta, ayuda y error accesibles. */
export function ProfileField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  disabled,
  readOnly,
  type = "text",
  autoComplete,
  maxLength,
  className,
  trailing,
}: ProfileFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(readOnly && "bg-surface-2 text-muted-foreground", trailing && "pr-10")}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger-strong">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Pie de una sección con el botón de guardar alineado a la derecha. */
export function SectionFooter({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4">
      {note && <p className="mr-auto text-xs text-muted-foreground">{note}</p>}
      {children}
    </div>
  );
}
