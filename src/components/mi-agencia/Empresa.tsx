import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, FileText, Landmark, PlusCircle, Save, Trash2 } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  Panel,
  SectionTabs,
  StatCard,
  type SectionTab,
} from "@/components/app";
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
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_NAME, LEGAL_RUT } from "@/lib/site";
import { CHILEAN_ACCOUNT_TYPES, CHILEAN_BANKS } from "@/lib/finance/banks";
import { formatRut, isValidRut } from "@/lib/rut";
import {
  invalidateAgency,
  useAgencyProfile,
  useBankAccounts,
  type AgencyProfile,
  type BankAccountRow,
  type CurrentOrg,
} from "@/lib/agency/queries";

export type EmpresaTab = "resumen" | "datos-legales" | "cuentas" | "facturacion";
export const EMPRESA_TABS: readonly EmpresaTab[] = [
  "resumen",
  "datos-legales",
  "cuentas",
  "facturacion",
];
export function isEmpresaTab(v: unknown): v is EmpresaTab {
  return typeof v === "string" && (EMPRESA_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<EmpresaTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "datos-legales", label: "Datos legales" },
  { key: "cuentas", label: "Cuentas bancarias" },
  { key: "facturacion", label: "Facturación" },
];

interface EmpresaPanelProps {
  org: CurrentOrg;
  canManage: boolean;
  tab: EmpresaTab;
  onTabChange: (tab: EmpresaTab) => void;
}

export function EmpresaPanel({ org, canManage, tab, onTabChange }: EmpresaPanelProps) {
  const profile = useAgencyProfile(org.orgId);
  const banks = useBankAccounts(org.orgId);

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Pestañas de Empresa" />

      {tab === "resumen" && <ResumenEmpresa profile={profile} banks={banks} />}
      {tab === "datos-legales" && (
        <DatosLegalesPanel profile={profile} orgId={org.orgId} canManage={canManage} />
      )}
      {tab === "cuentas" && (
        <CuentasBancariasPanel banks={banks} orgId={org.orgId} canManage={canManage} />
      )}
      {tab === "facturacion" && <FacturacionPanel />}
    </div>
  );
}

function ResumenEmpresa({
  profile,
  banks,
}: {
  profile: ReturnType<typeof useAgencyProfile>;
  banks: ReturnType<typeof useBankAccounts>;
}) {
  const p = profile.data;
  const legalName = p?.legal_name || LEGAL_NAME;
  const rut = p?.rut || LEGAL_RUT;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Razón social" icon={Building2} value={legalName} />
        <StatCard label="RUT" icon={FileText} value={formatRut(rut)} />
        <StatCard
          label="Cuentas bancarias"
          icon={Landmark}
          loading={banks.isLoading}
          value={banks.data?.length ?? 0}
        />
        <StatCard
          label="Giro registrado"
          icon={FileText}
          value={p?.giro ? "Sí" : "Pendiente"}
          hint={p?.giro ? p.giro : "Completa los datos legales"}
        />
      </div>
      <Panel
        icon={Building2}
        title="Datos de la empresa"
        description="Lo que verán los clientes en contratos, boletas y facturas."
      >
        {profile.isLoading ? (
          <ListSkeleton rows={3} label="Cargando datos" />
        ) : (
          <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Field label="Razón social" value={legalName} />
            <Field label="RUT" value={formatRut(rut)} />
            <Field label="Giro" value={p?.giro || "—"} />
            <Field
              label="Domicilio"
              value={
                [p?.address, p?.commune, p?.city].filter((v) => v && v.length > 0).join(", ") || "—"
              }
            />
            <Field label="Representante legal" value={p?.legal_representative || "—"} />
            <Field
              label="RUT representante"
              value={p?.legal_representative_rut ? formatRut(p.legal_representative_rut) : "—"}
            />
          </dl>
        )}
      </Panel>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 py-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function DatosLegalesPanel({
  profile,
  orgId,
  canManage,
}: {
  profile: ReturnType<typeof useAgencyProfile>;
  orgId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AgencyProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile.isLoading) return;
    setForm({
      id: profile.data?.id ?? "",
      org_id: orgId,
      legal_name: profile.data?.legal_name ?? LEGAL_NAME,
      rut: profile.data?.rut ?? LEGAL_RUT,
      giro: profile.data?.giro ?? "",
      address: profile.data?.address ?? "",
      commune: profile.data?.commune ?? "",
      city: profile.data?.city ?? "",
      legal_representative: profile.data?.legal_representative ?? "",
      legal_representative_rut: profile.data?.legal_representative_rut ?? "",
      contact_email: profile.data?.contact_email ?? "",
      contact_phone: profile.data?.contact_phone ?? "",
      website: profile.data?.website ?? "",
      billing_notes: profile.data?.billing_notes ?? "",
    });
  }, [profile.data, profile.isLoading, orgId]);

  if (profile.isLoading || !form) {
    return <ListSkeleton rows={6} label="Cargando datos legales" />;
  }
  if (profile.error) {
    return <ErrorState message={profile.error.message} onRetry={() => void profile.refetch()} />;
  }

  const rutValid = form.rut.length === 0 || isValidRut(form.rut);
  const repRutValid =
    form.legal_representative_rut.length === 0 || isValidRut(form.legal_representative_rut);

  const save = async () => {
    if (!canManage) return;
    if (!rutValid || !repRutValid) {
      toast.error("Revisa los RUT: alguno no es válido.");
      return;
    }
    setSaving(true);
    const payload = {
      org_id: orgId,
      legal_name: form.legal_name.trim(),
      rut: form.rut.trim(),
      giro: form.giro.trim(),
      address: form.address.trim(),
      commune: form.commune.trim(),
      city: form.city.trim(),
      legal_representative: form.legal_representative.trim(),
      legal_representative_rut: form.legal_representative_rut.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim(),
      website: form.website.trim(),
      billing_notes: form.billing_notes.trim(),
    };
    try {
      const { error } = await supabase
        .from("agency_profile")
        .upsert(payload, { onConflict: "org_id" });
      if (error) {
        if (error.code === "42501") {
          toast.error("Solo un administrador puede guardar los datos de la empresa.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Datos guardados");
      await invalidateAgency(qc);
    } finally {
      setSaving(false);
    }
  };

  const disabled = !canManage;

  return (
    <Panel
      icon={Building2}
      title="Datos legales"
      description="Información de la empresa para contratos y documentos tributarios."
      actions={
        canManage ? (
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" aria-hidden /> {saving ? "Guardando…" : "Guardar"}
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField label="Razón social" htmlFor="legal_name">
          <Input
            id="legal_name"
            value={form.legal_name}
            maxLength={160}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
          />
        </FormField>
        <FormField
          label="RUT"
          htmlFor="rut"
          hint={rutValid ? undefined : "RUT inválido"}
          invalid={!rutValid}
        >
          <Input
            id="rut"
            value={form.rut}
            maxLength={20}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, rut: e.target.value })}
            onBlur={() => setForm({ ...form, rut: formatRut(form.rut) })}
          />
        </FormField>
        <FormField label="Giro" htmlFor="giro">
          <Input
            id="giro"
            value={form.giro}
            maxLength={160}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, giro: e.target.value })}
          />
        </FormField>
        <FormField label="Sitio web" htmlFor="website">
          <Input
            id="website"
            value={form.website}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://"
          />
        </FormField>
        <FormField label="Dirección" htmlFor="address">
          <Input
            id="address"
            value={form.address}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </FormField>
        <FormField label="Comuna" htmlFor="commune">
          <Input
            id="commune"
            value={form.commune}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, commune: e.target.value })}
          />
        </FormField>
        <FormField label="Ciudad" htmlFor="city">
          <Input
            id="city"
            value={form.city}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </FormField>
        <FormField label="Representante legal" htmlFor="rep">
          <Input
            id="rep"
            value={form.legal_representative}
            maxLength={160}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, legal_representative: e.target.value })}
          />
        </FormField>
        <FormField
          label="RUT representante"
          htmlFor="rep_rut"
          hint={repRutValid ? undefined : "RUT inválido"}
          invalid={!repRutValid}
        >
          <Input
            id="rep_rut"
            value={form.legal_representative_rut}
            maxLength={20}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, legal_representative_rut: e.target.value })}
            onBlur={() =>
              setForm({
                ...form,
                legal_representative_rut: formatRut(form.legal_representative_rut),
              })
            }
          />
        </FormField>
        <FormField label="Correo de contacto" htmlFor="contact_email">
          <Input
            id="contact_email"
            value={form.contact_email}
            type="email"
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
        </FormField>
        <FormField label="Teléfono de contacto" htmlFor="contact_phone">
          <Input
            id="contact_phone"
            value={form.contact_phone}
            maxLength={40}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Notas de facturación" htmlFor="billing_notes">
            <Textarea
              id="billing_notes"
              value={form.billing_notes}
              maxLength={1000}
              rows={2}
              disabled={disabled}
              onChange={(e) => setForm({ ...form, billing_notes: e.target.value })}
              placeholder="Opcional (condiciones, referencias, etc.)"
            />
          </FormField>
        </div>
      </div>
      {!canManage && (
        <p className="mt-3 text-xs text-muted-foreground">
          Solo un administrador puede modificar los datos legales.
        </p>
      )}
    </Panel>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  invalid,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && (
        <p className={invalid ? "text-xs text-danger-strong" : "text-xs text-muted-foreground"}>
          {hint}
        </p>
      )}
    </div>
  );
}

function CuentasBancariasPanel({
  banks,
  orgId,
  canManage,
}: {
  banks: ReturnType<typeof useBankAccounts>;
  orgId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<BankAccountRow, "id" | "org_id" | "created_at">>({
    bank_code: CHILEAN_BANKS[0],
    account_type: CHILEAN_ACCOUNT_TYPES[0],
    account_number: "",
    holder_name: "",
    holder_rut: "",
    holder_email: "",
    label: "",
    is_primary: false,
    notes: "",
  });

  if (banks.isLoading) return <ListSkeleton rows={3} label="Cargando cuentas" />;
  if (banks.error)
    return <ErrorState message={banks.error.message} onRetry={() => void banks.refetch()} />;

  const rows = banks.data ?? [];

  const save = async () => {
    if (!canManage) return;
    if (draft.holder_rut && !isValidRut(draft.holder_rut)) {
      toast.error("El RUT del titular no es válido.");
      return;
    }
    if (!draft.account_number.trim()) {
      toast.error("Ingresa el número de la cuenta.");
      return;
    }
    const { error } = await supabase.from("agency_bank_accounts").insert({
      org_id: orgId,
      bank_code: draft.bank_code,
      account_type: draft.account_type,
      account_number: draft.account_number.trim(),
      holder_name: draft.holder_name.trim(),
      holder_rut: draft.holder_rut.trim(),
      holder_email: draft.holder_email.trim(),
      label: draft.label.trim(),
      is_primary: draft.is_primary,
      notes: draft.notes.trim(),
    });
    if (error) {
      if (error.code === "42501") {
        toast.error("Solo un administrador puede agregar cuentas.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Cuenta agregada");
    setAdding(false);
    setDraft({
      bank_code: CHILEAN_BANKS[0],
      account_type: CHILEAN_ACCOUNT_TYPES[0],
      account_number: "",
      holder_name: "",
      holder_rut: "",
      holder_email: "",
      label: "",
      is_primary: false,
      notes: "",
    });
    await invalidateAgency(qc);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("agency_bank_accounts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cuenta eliminada");
    await invalidateAgency(qc);
  };

  return (
    <Panel
      icon={Landmark}
      title={`Cuentas bancarias (${rows.length})`}
      description="Datos para recibir transferencias de tus clientes."
      actions={
        canManage ? (
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden />
            {adding ? "Cerrar" : "Agregar cuenta"}
          </Button>
        ) : null
      }
    >
      {adding && (
        <div className="mb-4 rounded-app-md border border-border-subtle bg-surface-2 p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField label="Banco" htmlFor="bank">
              <Select
                value={draft.bank_code}
                onValueChange={(v) => setDraft({ ...draft, bank_code: v })}
              >
                <SelectTrigger id="bank">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHILEAN_BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tipo de cuenta" htmlFor="type">
              <Select
                value={draft.account_type}
                onValueChange={(v) => setDraft({ ...draft, account_type: v })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHILEAN_ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Número de cuenta" htmlFor="num">
              <Input
                id="num"
                value={draft.account_number}
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, account_number: e.target.value })}
              />
            </FormField>
            <FormField label="Titular" htmlFor="holder">
              <Input
                id="holder"
                value={draft.holder_name}
                maxLength={160}
                onChange={(e) => setDraft({ ...draft, holder_name: e.target.value })}
              />
            </FormField>
            <FormField label="RUT titular" htmlFor="holder_rut">
              <Input
                id="holder_rut"
                value={draft.holder_rut}
                maxLength={20}
                onChange={(e) => setDraft({ ...draft, holder_rut: e.target.value })}
                onBlur={() => setDraft({ ...draft, holder_rut: formatRut(draft.holder_rut) })}
              />
            </FormField>
            <FormField label="Correo" htmlFor="holder_email">
              <Input
                id="holder_email"
                type="email"
                value={draft.holder_email}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, holder_email: e.target.value })}
              />
            </FormField>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save}>
              Guardar cuenta
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Sin cuentas registradas"
          description={
            canManage
              ? "Agrega la cuenta BCI de Nexus (o la que uses) para compartirla con tus clientes."
              : "Pídele a un administrador que registre una cuenta."
          }
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  {b.bank_code} · {b.account_type}
                </p>
                <p className="tabular-nums text-muted-foreground">{b.account_number}</p>
                {b.holder_name && (
                  <p className="text-xs text-muted-foreground">
                    Titular: {b.holder_name}
                    {b.holder_rut ? ` · ${formatRut(b.holder_rut)}` : ""}
                    {b.holder_email ? ` · ${b.holder_email}` : ""}
                  </p>
                )}
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(b.id)}
                  aria-label={`Eliminar cuenta ${b.bank_code}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function FacturacionPanel() {
  return (
    <Panel
      icon={FileText}
      title="Facturación electrónica"
      description="Emisión de boletas y facturas desde la plataforma."
    >
      <EmptyState
        icon={FileText}
        title="Conexión con SII pendiente"
        description="Hoy se emite fuera de la plataforma. Cuando se conecte la facturación electrónica, verás aquí la resolución, los folios y el ambiente (certificación o producción)."
      />
    </Panel>
  );
}
