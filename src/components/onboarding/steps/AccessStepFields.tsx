import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCESS_STATES, ACCESS_STATE_LABELS, MAX_ACCESSES, type AccessState } from "@/lib/onboarding/schema";
import { newRowId, type AccessRow } from "../formState";
import type { StepProps } from "./types";

/** Paso 4: checklist de accesos (servicio / estado / nota). Nunca contraseñas. */
export function AccessStepFields({ state, update, errors }: StepProps) {
  const setRow = (id: string, patch: Partial<AccessRow>) =>
    update({ accesos: state.accesos.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const removeRow = (id: string) => update({ accesos: state.accesos.filter((r) => r.id !== id) });
  const addRow = () =>
    update({ accesos: [...state.accesos, { id: newRowId(), servicio: "", estado: "pendiente", nota: "" }] });

  return (
    <div className="space-y-5">
      <div role="note" className="flex gap-3 rounded-app-lg border border-warning/40 bg-warning-subtle p-4 text-sm">
        <ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Nunca escribas contraseñas aquí.</p>
          <p className="text-muted-foreground">
            Solo cuéntanos el estado de cada acceso. Te guiaremos para invitarnos como colaboradores desde cada
            plataforma, sin compartir tus claves.
          </p>
        </div>
      </div>

      {errors.accesos_pendientes && <p className="text-sm text-danger-strong">{errors.accesos_pendientes}</p>}

      <ul className="space-y-3">
        {state.accesos.map((row, i) => {
          const servicioErr = errors[`accesos_pendientes.${i}.servicio`];
          const notaErr = errors[`accesos_pendientes.${i}.nota`];
          return (
            <li key={row.id} className="space-y-3 rounded-app-lg border border-border-subtle bg-surface p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <label htmlFor={`${row.id}-servicio`} className="sr-only">
                    Servicio
                  </label>
                  <Input
                    id={`${row.id}-servicio`}
                    value={row.servicio}
                    maxLength={80}
                    placeholder="Servicio (ej. Mercado Libre)"
                    onChange={(e) => setRow(row.id, { servicio: e.target.value })}
                    aria-invalid={Boolean(servicioErr)}
                    className="h-11 text-base font-medium sm:text-sm"
                  />
                  {servicioErr && <p className="text-xs text-danger-strong">{servicioErr}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)} aria-label={`Quitar ${row.servicio || "acceso"}`}>
                  <Trash2 aria-hidden className="h-4 w-4" />
                </Button>
              </div>
              <fieldset>
                <legend className="sr-only">Estado de {row.servicio || "este acceso"}</legend>
                <div className="flex flex-wrap gap-2">
                  {ACCESS_STATES.map((estado: AccessState) => (
                    <label
                      key={estado}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                        row.estado === estado
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-subtle text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${row.id}-estado`}
                        value={estado}
                        checked={row.estado === estado}
                        onChange={() => setRow(row.id, { estado })}
                        className="sr-only"
                      />
                      {ACCESS_STATE_LABELS[estado]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-1">
                <label htmlFor={`${row.id}-nota`} className="sr-only">
                  Nota
                </label>
                <Input
                  id={`${row.id}-nota`}
                  value={row.nota}
                  maxLength={300}
                  placeholder="Nota opcional (ej. la cuenta la maneja mi socio). Sin contraseñas."
                  onChange={(e) => setRow(row.id, { nota: e.target.value })}
                  aria-invalid={Boolean(notaErr)}
                  className="h-11 text-base sm:text-sm"
                />
                {notaErr && <p className="text-xs text-danger-strong">{notaErr}</p>}
              </div>
            </li>
          );
        })}
      </ul>

      {state.accesos.length < MAX_ACCESSES && (
        <Button type="button" variant="outline" onClick={addRow} className="w-full sm:w-auto">
          <Plus aria-hidden className="mr-1.5 h-4 w-4" /> Agregar otro servicio
        </Button>
      )}
    </div>
  );
}
