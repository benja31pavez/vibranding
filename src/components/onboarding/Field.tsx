import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (a11y: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}

/** Etiqueta + control + ayuda + error accesible (aria-describedby). */
export function Field({ id, label, hint, error, optional, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  maxLength: number;
  multiline?: boolean;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "url";
}

export function TextField({
  multiline,
  value,
  onChange,
  maxLength,
  placeholder,
  type,
  autoComplete,
  inputMode,
  ...field
}: TextFieldProps) {
  return (
    <Field {...field}>
      {(a11y) =>
        multiline ? (
          <Textarea
            {...a11y}
            value={value}
            maxLength={maxLength}
            rows={4}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="text-base sm:text-sm"
          />
        ) : (
          <Input
            {...a11y}
            type={type ?? "text"}
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            autoComplete={autoComplete}
            inputMode={inputMode}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 text-base sm:text-sm"
          />
        )
      }
    </Field>
  );
}
