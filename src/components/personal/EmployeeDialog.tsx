import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatearRut, validarRutChileno } from "@/lib/rut";
import {
  emptyEmployeeForm,
  EMPLOYEE_RANKS,
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_META,
  employeeToForm,
  type Employee,
  type EmployeeFormValues,
  type EmployeeStatus,
  useCreateEmployee,
  useUpdateEmployee,
} from "./personalData";

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  /** Si viene, el diálogo edita este empleado; si no, crea uno nuevo. */
  employee?: Employee | null;
}

/** Simple regex de correo para validar antes de enviar (coincide con el usado en onboarding). */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Diálogo de creación y edición de un empleado del cliente. Valida RUT chileno
 * con el algoritmo módulo 11 antes de enviar y muestra el error inline si falla.
 */
export function EmployeeDialog({ open, onOpenChange, clientId, employee }: EmployeeDialogProps) {
  const editing = Boolean(employee);
  const [form, setForm] = useState<EmployeeFormValues>(emptyEmployeeForm);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormValues, string>>>({});

  const createMut = useCreateEmployee(clientId);
  const updateMut = useUpdateEmployee(clientId);
  const pending = createMut.isPending || updateMut.isPending;

  // Resetea el formulario cuando se abre con un empleado distinto o nuevo.
  useEffect(() => {
    if (open) {
      setForm(employee ? employeeToForm(employee) : emptyEmployeeForm);
      setErrors({});
    }
  }, [open, employee]);

  function set<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validar(): boolean {
    const nextErrors: Partial<Record<keyof EmployeeFormValues, string>> = {};
    if (!form.full_name.trim()) {
      nextErrors.full_name = "Escribe el nombre completo";
    }
    if (form.rut.trim() && !validarRutChileno(form.rut)) {
      nextErrors.rut = "RUT inválido. Revisa el dígito verificador.";
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      nextErrors.email = "Correo inválido";
    }
    if (form.started_at && form.ended_at && form.ended_at < form.started_at) {
      nextErrors.ended_at = "La fecha de salida no puede ser antes del ingreso";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleRutBlur() {
    const v = form.rut.trim();
    if (v && validarRutChileno(v)) {
      setForm((f) => ({ ...f, rut: formatearRut(v) }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    try {
      if (employee) {
        await updateMut.mutateAsync({ id: employee.id, values: form });
        toast.success("Empleado actualizado");
      } else {
        await createMut.mutateAsync(form);
        toast.success("Empleado agregado");
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar empleado" : "Agregar empleado"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Actualiza los datos del integrante del equipo del cliente."
              : "Carga los datos de una persona del equipo del cliente. Solo el nombre es obligatorio."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="emp-full-name">Nombre completo *</Label>
              <Input
                id="emp-full-name"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                autoFocus
                maxLength={160}
                aria-invalid={Boolean(errors.full_name)}
                aria-describedby={errors.full_name ? "emp-full-name-error" : undefined}
              />
              {errors.full_name && (
                <p id="emp-full-name-error" className="mt-1 text-xs text-danger-strong">
                  {errors.full_name}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="emp-rut">RUT</Label>
              <Input
                id="emp-rut"
                value={form.rut}
                onChange={(e) => set("rut", e.target.value)}
                onBlur={handleRutBlur}
                placeholder="12.345.678-5"
                maxLength={20}
                aria-invalid={Boolean(errors.rut)}
                aria-describedby={errors.rut ? "emp-rut-error" : undefined}
              />
              {errors.rut && (
                <p id="emp-rut-error" className="mt-1 text-xs text-danger-strong">
                  {errors.rut}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="emp-email">Correo</Label>
              <Input
                id="emp-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                maxLength={254}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "emp-email-error" : undefined}
              />
              {errors.email && (
                <p id="emp-email-error" className="mt-1 text-xs text-danger-strong">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="emp-phone">Teléfono</Label>
              <Input
                id="emp-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                maxLength={40}
                placeholder="+56 9 1234 5678"
              />
            </div>

            <div>
              <Label htmlFor="emp-role">Cargo</Label>
              <Input
                id="emp-role"
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                maxLength={80}
                placeholder="Encargado de local, Ejecutivo de cuentas…"
              />
            </div>

            <div>
              <Label htmlFor="emp-rank">Rango</Label>
              <Select
                value={form.rank || "__ninguno__"}
                onValueChange={(v) => set("rank", v === "__ninguno__" ? "" : v)}
              >
                <SelectTrigger id="emp-rank">
                  <SelectValue placeholder="Sin rango" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ninguno__">Sin rango</SelectItem>
                  {EMPLOYEE_RANKS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="emp-department">Departamento</Label>
              <Input
                id="emp-department"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                maxLength={80}
                placeholder="Ventas, Marketing, Operaciones…"
              />
            </div>

            <div>
              <Label htmlFor="emp-status">Estado</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as EmployeeStatus)}>
                <SelectTrigger id="emp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {EMPLOYEE_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="emp-started-at">Fecha de ingreso</Label>
              <Input
                id="emp-started-at"
                type="date"
                value={form.started_at}
                onChange={(e) => set("started_at", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="emp-ended-at">Fecha de salida</Label>
              <Input
                id="emp-ended-at"
                type="date"
                value={form.ended_at}
                onChange={(e) => set("ended_at", e.target.value)}
                aria-invalid={Boolean(errors.ended_at)}
                aria-describedby={errors.ended_at ? "emp-ended-at-error" : undefined}
              />
              {errors.ended_at && (
                <p id="emp-ended-at-error" className="mt-1 text-xs text-danger-strong">
                  {errors.ended_at}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="emp-notes">Notas</Label>
              <Textarea
                id="emp-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="Observaciones internas"
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : editing ? "Guardar cambios" : "Agregar empleado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
