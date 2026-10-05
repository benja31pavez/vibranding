import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PLANS } from "@/lib/pricing/plans";
import {
  BAJA_NOTICE,
  EMPTY_FORM,
  PROSPECT_STATES,
  REVOKE_MOTIVO_MAX,
  REVOKE_MOTIVO_MIN,
  REVOKE_TARGET_STATES,
  STATE_META,
  type RevokeTargetState,
  fieldErrors,
  prospectSchema,
  type ProspectFormInput,
} from "@/lib/prospects/schema";
import { toDateInput } from "./format";
import { ConvertAction } from "./ProspectCard";
import { ProposalsPanel } from "@/components/proposals/ProposalsPanel";
import { canCreateProposalFor } from "@/lib/proposals/recommend";
import { FollowupsPanel } from "@/components/followups/FollowupsPanel";
import { useCanEditRecipient } from "@/components/proposals/proposalQueries";
import { useIsOrgManager, useRevokeBaja, useSaveProspect, type Prospect } from "./prospectsData";

type Errors = Partial<Record<keyof ProspectFormInput, string>>;

function toForm(p: Prospect | null): ProspectFormInput {
  if (!p) return EMPTY_FORM;
  return {
    nombre: p.nombre,
    rubro: p.rubro ?? "",
    comuna: p.comuna ?? "",
    web: p.web ?? "",
    instagram: p.instagram ?? "",
    email_publico: p.email_publico ?? "",
    telefono_publico: p.telefono_publico ?? "",
    fuente: p.fuente,
    estado: PROSPECT_STATES.includes(p.estado as never)
      ? (p.estado as ProspectFormInput["estado"])
      : "nuevo",
    producto_sugerido: (PLANS.some((pl) => pl.key === p.producto_sugerido)
      ? p.producto_sugerido
      : "") as ProspectFormInput["producto_sugerido"],
    notas: p.notas ?? "",
    ultimo_contacto: toDateInput(p.ultimo_contacto),
  };
}

const selectCls =
  "h-9 w-full rounded-app-sm border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger-strong">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProspectSheet({
  open,
  prospect,
  onOpenChange,
  onConvert,
}: {
  open: boolean;
  /** null = nuevo prospecto. */
  prospect: Prospect | null;
  onOpenChange: (open: boolean) => void;
  onConvert: (p: Prospect) => void;
}) {
  const [form, setForm] = useState<ProspectFormInput>(() => toForm(prospect));
  const [errors, setErrors] = useState<Errors>({});
  const [confirmUnbaja, setConfirmUnbaja] = useState(false);
  const [motivo, setMotivo] = useState("");
  const save = useSaveProspect();
  const revoke = useRevokeBaja();
  const isBaja = prospect?.estado === "baja";
  const manager = useIsOrgManager(isBaja ? prospect?.org_id : null);
  // Si no se pudo consultar el rol, se muestra el control y la RPC decide (muestra su error).
  const canRevoke = manager.data !== false;
  const canEditProposals = useCanEditRecipient(
    prospect ? { kind: "prospect", id: prospect.id, orgId: prospect.org_id } : null,
  );

  // Se reinicia solo al abrir o al cambiar de prospecto (no en refetch): si la RPC
  // falla tras guardar los campos, el motivo escrito se conserva para reintentar.
  const prospectId = prospect?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setForm(toForm(prospect));
    setErrors({});
    setConfirmUnbaja(false);
    setMotivo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prospectId]);

  const set =
    <K extends keyof ProspectFormInput>(key: K) =>
    (value: ProspectFormInput[K]) =>
      setForm((f) => ({ ...f, [key]: value }));
  const leavingBaja = isBaja && form.estado !== "baja";
  const motivoClean = motivo.trim().replace(/\s+/g, " ");
  const busy = save.isPending || revoke.isPending;

  /** Error de la salida de baja (null si se puede guardar). */
  const revokeProblem = (): string | null => {
    if (!canRevoke) return "Solo un owner/admin puede revocar una baja.";
    if (!(REVOKE_TARGET_STATES as readonly string[]).includes(form.estado)) {
      return `Al salir de baja el prospecto no puede quedar como ${STATE_META[form.estado].label}.`;
    }
    if (!confirmUnbaja)
      return "Confirma que el prospecto retiró su solicitud de baja antes de cambiar el estado.";
    if (motivoClean.length < REVOKE_MOTIVO_MIN || motivoClean.length > REVOKE_MOTIVO_MAX) {
      return `Indica el motivo (entre ${REVOKE_MOTIVO_MIN} y ${REVOKE_MOTIVO_MAX} caracteres).`;
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = prospectSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    const problem = leavingBaja ? revokeProblem() : null;
    if (problem) {
      toast.error(problem);
      return;
    }
    setErrors({});
    try {
      if (leavingBaja && prospect) {
        // Primero se guardan los demás campos (sigue en baja) y luego la RPC sale de baja:
        // así la línea que la RPC agrega a las notas no se pisa.
        await save.mutateAsync({ id: prospect.id, values: { ...parsed.data, estado: "baja" } });
        await revoke.mutateAsync({
          id: prospect.id,
          motivo: motivoClean,
          estado: form.estado as RevokeTargetState,
        });
        toast.success(`Baja revocada: ${prospect.nombre} → ${STATE_META[form.estado].label}`);
        onOpenChange(false);
        return;
      }
      await save.mutateAsync({ id: prospect?.id, values: parsed.data });
      toast.success(prospect ? "Prospecto actualizado" : "Prospecto creado");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el prospecto");
    }
  };

  const input = (key: keyof ProspectFormInput, props: React.ComponentProps<typeof Input> = {}) => (
    <Input
      id={`pr-${key}`}
      value={form[key] as string}
      onChange={(e) => set(key)(e.target.value as never)}
      aria-invalid={Boolean(errors[key])}
      aria-describedby={errors[key] ? `pr-${key}-error` : undefined}
      {...props}
    />
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{prospect ? "Editar prospecto" : "Nuevo prospecto"}</SheetTitle>
          <SheetDescription>
            Guarda solo datos públicos de contacto del negocio, nunca datos personales.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <Field id="pr-nombre" label="Nombre del negocio *" error={errors.nombre}>
            {input("nombre", { required: true })}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pr-rubro" label="Rubro" error={errors.rubro}>
              {input("rubro")}
            </Field>
            <Field id="pr-comuna" label="Comuna" error={errors.comuna}>
              {input("comuna")}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pr-web" label="Web" error={errors.web}>
              {input("web", { placeholder: "misitio.cl", inputMode: "url" })}
            </Field>
            <Field id="pr-instagram" label="Instagram" error={errors.instagram}>
              {input("instagram", { placeholder: "@usuario o URL" })}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pr-email_publico" label="Correo público" error={errors.email_publico}>
              {input("email_publico", { type: "email", inputMode: "email" })}
            </Field>
            <Field
              id="pr-telefono_publico"
              label="Teléfono público"
              error={errors.telefono_publico}
            >
              {input("telefono_publico", { type: "tel", placeholder: "+56 9 1234 5678" })}
            </Field>
          </div>
          <Field
            id="pr-fuente"
            label="Fuente del dato *"
            error={errors.fuente}
            hint="Dónde se vio el contacto (ej. sitio web, página Contacto)."
          >
            {input("fuente", { required: true })}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pr-estado" label="Estado" error={errors.estado}>
              <select
                id="pr-estado"
                className={selectCls}
                value={form.estado}
                onChange={(e) => set("estado")(e.target.value as ProspectFormInput["estado"])}
              >
                {PROSPECT_STATES.map((s) => (
                  <option key={s} value={s}>
                    {STATE_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="pr-producto_sugerido"
              label="Producto sugerido"
              error={errors.producto_sugerido}
            >
              <select
                id="pr-producto_sugerido"
                className={selectCls}
                value={form.producto_sugerido}
                onChange={(e) =>
                  set("producto_sugerido")(e.target.value as ProspectFormInput["producto_sugerido"])
                }
              >
                <option value="">Sin definir</option>
                {PLANS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.returningClientsOnly ? `${p.label} (solo ex clientes)` : p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {form.estado === "baja" && (
            <div
              role="alert"
              className="flex gap-2 rounded-app-md border border-danger/40 bg-danger-subtle p-3 text-sm text-danger-strong"
            >
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{BAJA_NOTICE}</p>
            </div>
          )}
          {leavingBaja && !canRevoke && (
            <p
              role="alert"
              className="rounded-app-md border border-danger/40 bg-danger-subtle p-3 text-sm text-danger-strong"
            >
              Solo un owner/admin de la organización puede revocar una baja.
            </p>
          )}
          {leavingBaja && canRevoke && (
            <div className="space-y-3 rounded-app-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-strong">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirmUnbaja}
                  onChange={(e) => setConfirmUnbaja(e.target.checked)}
                  className="mt-0.5"
                />
                Confirmo que el prospecto retiró por escrito su solicitud de no ser contactado.
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="pr-motivo-baja">Motivo *</Label>
                <Textarea
                  id="pr-motivo-baja"
                  rows={2}
                  maxLength={REVOKE_MOTIVO_MAX}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  aria-describedby="pr-motivo-baja-hint"
                  className="bg-background text-foreground"
                />
                <p id="pr-motivo-baja-hint" className="text-xs">
                  Cómo y cuándo retiró la solicitud ({REVOKE_MOTIVO_MIN}–{REVOKE_MOTIVO_MAX}{" "}
                  caracteres). Queda en las notas.
                </p>
              </div>
            </div>
          )}
          <Field id="pr-ultimo_contacto" label="Último contacto" error={errors.ultimo_contacto}>
            {input("ultimo_contacto", { type: "date" })}
          </Field>
          <Field id="pr-notas" label="Notas" error={errors.notas}>
            <Textarea
              id="pr-notas"
              rows={4}
              value={form.notas}
              onChange={(e) => set("notas")(e.target.value)}
            />
          </Field>
          <SheetFooter className="gap-2 sm:justify-between">
            <div>
              {prospect && (
                <ConvertAction
                  prospect={prospect}
                  onConvert={onConvert}
                  label="Convertir en cliente"
                />
              )}
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </SheetFooter>
        </form>
        {prospect && (
          <div className="mt-6">
            <FollowupsPanel
              scope={{ prospectId: prospect.id }}
              hideOpenForProspect
              hideWhenEmpty
              // Sincroniza el formulario: así "Guardar" (con o sin otros cambios) no pisa el contacto recién registrado.
              onProspectContactRecorded={(id, contactedAt) => {
                if (id === prospect.id) set("ultimo_contacto")(toDateInput(contactedAt));
              }}
            />
          </div>
        )}
        {prospect && (
          <div className="mt-6 border-t border-border-subtle pt-6">
            {/* Si el permiso no se pudo consultar, se muestra el botón y la BD decide (RLS). */}
            <ProposalsPanel
              prospectId={prospect.id}
              canEdit={canEditProposals.data !== false}
              canCreate={canCreateProposalFor(prospect.estado)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
