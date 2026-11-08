import { useEffect, useState } from "react";
import { CLAUSE_DEFAULTS } from "@/lib/contracts/clauseDefaults";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/app";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  MessageCircle,
  MonitorSmartphone,
  FileSignature,
  Building2,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { PlanCatalog, VatLines } from "@/components/pricing/PlanCatalog";
import {
  CHATBOT_ADDON as CHATBOT,
  LANDING_ADDON as LANDING,
  type Addon,
} from "@/lib/pricing/addons";
import { AGENCY_DEFAULTS, DEFAULT_CURRENCY, formatMoney } from "@/lib/pricing/plans";

/**
 * Servicios adicionales que se suman a un plan. Desde 2026-10-06 su precio es
 * FIJO y vive en `@/lib/pricing/addons` (netos + IVA, igual que los planes).
 * La tabla `service_pricing` solo guarda si se ofrecen (`is_active`) y el texto
 * "Qué incluye"; sus columnas de precio ya no se usan.
 */
export type ServiceKey = "chatbot" | "landing";

export const SERVICE_CATALOG: Array<{
  key: ServiceKey;
  label: string;
  description: string;
  icon: any;
  tone: string;
  /** Precio fijo (addons.ts): nunca a medida. */
  addon: Addon;
}> = [
  {
    key: "chatbot",
    label: CHATBOT.label,
    description: "Número de WhatsApp dedicado con chatbot que responde, califica y agenda.",
    icon: MessageCircle,
    tone: "var(--brand-3)",
    addon: CHATBOT,
  },
  {
    key: "landing",
    label: LANDING.label,
    description: LANDING.description,
    icon: MonitorSmartphone,
    tone: "var(--brand-2)",
    addon: LANDING,
  },
];

// ───────── Types ─────────

export interface PricingSettings {
  id: string;
  user_id: string;
  /** Siempre 'CLP' (CHECK en la BD). */
  currency: string;
  // legacy IG breakdown (still used in Instagram cost summary)
  pack_price: number;
  pack_description: string | null;
  photo_price: number;
  carousel_price: number;
  reel_price: number;
  notes: string | null;
  // contract / agency
  agency_legal_name: string | null;
  agency_tax_id: string | null;
  agency_address: string | null;
  agency_email: string | null;
  payment_due_days: number;
  clause_esim: string | null;
  clause_meta_api: string | null;
  clause_late_payment: string | null;
  clause_extra: string | null;
  jurisdiction: string | null;
}

export interface ServicePricing {
  id: string;
  user_id: string;
  service_key: ServiceKey;
  one_time_price: number;
  monthly_price: number;
  included_text: string | null;
  is_active: boolean;
}

// ───────── Loaders ─────────

export async function loadPricing(userId: string): Promise<PricingSettings | null> {
  const { data, error } = await supabase
    .from("pricing_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as PricingSettings;
  const { data: created, error: insertError } = await supabase
    .from("pricing_settings")
    .insert({
      user_id: userId,
      currency: DEFAULT_CURRENCY,
      agency_legal_name: AGENCY_DEFAULTS.legal_name,
      agency_tax_id: AGENCY_DEFAULTS.tax_id,
      agency_address: AGENCY_DEFAULTS.address,
      jurisdiction: AGENCY_DEFAULTS.jurisdiction,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return (created as PricingSettings) ?? null;
}

export async function loadServicePricing(
  userId: string,
): Promise<Record<ServiceKey, ServicePricing>> {
  const { data, error } = await supabase.from("service_pricing").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const byKey: Partial<Record<ServiceKey, ServicePricing>> = {};
  const isAddon = (k: string): k is ServiceKey => SERVICE_CATALOG.some((s) => s.key === k);
  (data ?? []).forEach((row: any) => {
    const key = String(row.service_key);
    if (isAddon(key)) byKey[key] = row as ServicePricing;
  });

  // Seed any missing add-on rows in a single round trip.
  const missing = SERVICE_CATALOG.filter((s) => !byKey[s.key]);
  if (missing.length > 0) {
    const { data: created, error: seedError } = await supabase
      .from("service_pricing")
      .insert(missing.map((s) => ({ user_id: userId, service_key: s.key })))
      .select("*");
    if (seedError) throw new Error(seedError.message);
    (created ?? []).forEach((row: any) => {
      byKey[row.service_key as ServiceKey] = row as ServicePricing;
    });
  }
  return byKey as Record<ServiceKey, ServicePricing>;
}

// ───────── UI helpers ─────────

function TextLine({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={(value ?? "") as any}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      />
    </div>
  );
}

// ───────── Main Panel ─────────

export function PricingPanel() {
  const { user } = useAuth();
  const [p, setP] = useState<PricingSettings | null>(null);
  const [services, setServices] = useState<Record<ServiceKey, ServicePricing> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadError(null);
    setP(null);
    setServices(null);
    Promise.all([loadPricing(user.id), loadServicePricing(user.id)])
      .then(([pricing, svc]) => {
        if (cancelled) return;
        setP(pricing);
        setServices(svc);
      })
      .catch((e: any) => {
        if (!cancelled) setLoadError(e?.message ?? "Error desconocido");
      });
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  if (loadError) {
    return (
      <ErrorState
        title="No se pudieron cargar tus servicios"
        message={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
        className="max-w-lg"
      />
    );
  }
  if (!p || !services) return <ListSkeleton rows={5} label="Cargando precios y servicios" />;

  const flashSaved = () => {
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1600);
  };

  const setP_ = (patch: Partial<PricingSettings>) => setP({ ...p, ...patch });
  const saveP = async (patch: Partial<PricingSettings>) => {
    setSaveState("saving");
    const { data, error } = await supabase
      .from("pricing_settings")
      .update(patch)
      .eq("id", p.id)
      .select("id");
    if (error) {
      setSaveState("idle");
      toast.error(error.message);
      return;
    }
    // No error but no row means RLS silently refused the write.
    if (!data || data.length === 0) {
      setSaveState("idle");
      toast.error("No se guardó: no tienes permiso sobre este registro.");
      return;
    }
    flashSaved();
  };

  const updateService = (key: ServiceKey, patch: Partial<ServicePricing>) => {
    setServices({ ...services, [key]: { ...services[key], ...patch } });
  };
  const saveService = async (id: string, patch: Partial<ServicePricing>) => {
    setSaveState("saving");
    const { data, error } = await supabase
      .from("service_pricing")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error) {
      setSaveState("idle");
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setSaveState("idle");
      toast.error("No se guardó: no tienes permiso sobre este registro.");
      return;
    }
    flashSaved();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Precios"
        description="Precios fijos, netos en CLP + IVA (19 %)."
        actions={<SaveIndicator state={saveState} />}
      />

      {/* Plans (fixed, CLP, precios netos + IVA) */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Planes</h2>
          <span className="text-xs text-muted-foreground">Precios netos en CLP · + IVA (19%)</span>
        </div>
        <PlanCatalog />
      </div>

      {/* Add-on services */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Servicios adicionales</h2>
          <span className="text-xs text-muted-foreground">
            Precio fijo neto + IVA (19%) · La mantención mensual se cobra junto al plan
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERVICE_CATALOG.map((svc) => {
            const row = services[svc.key];
            const addon = svc.addon;
            const Icon = svc.icon;
            return (
              <div
                key={svc.key}
                className={`rounded-app-lg border bg-surface p-5 space-y-4 shadow-app-xs transition-shadow hover:shadow-app-md ${row.is_active ? "" : "opacity-60"}`}
                style={{ borderColor: `color-mix(in oklab, ${svc.tone} 25%, hsl(var(--border)))` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${svc.tone}, color-mix(in oklab, ${svc.tone} 55%, white))`,
                    }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-tight">{svc.label}</div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {svc.description}
                    </p>
                  </div>
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={(v) => {
                      updateService(svc.key, { is_active: v });
                      saveService(row.id, { is_active: v });
                    }}
                    aria-label={`Ofrecer ${svc.label}`}
                  />
                </div>

                <div className="space-y-1 rounded-app-md bg-surface-2/60 px-3 py-2">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMoney(addon.setupNet)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      + IVA pago único
                    </span>
                    {addon.monthlyNet > 0 && (
                      <>
                        {" · "}
                        {formatMoney(addon.monthlyNet)}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          + IVA/mes
                        </span>
                      </>
                    )}
                  </p>
                  <VatLines label="Pago único" net={addon.setupNet} />
                  {addon.monthlyNet > 0 && <VatLines label="Mensual" net={addon.monthlyNet} />}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Qué incluye</Label>
                  <Textarea
                    rows={2}
                    value={row.included_text ?? ""}
                    onChange={(e) => updateService(svc.key, { included_text: e.target.value })}
                    onBlur={(e) => saveService(row.id, { included_text: e.target.value || null })}
                    placeholder="Detalle breve de lo que entregas en este servicio…"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agency / contract template */}
      <SettingsSection
        title="Datos de tu agencia"
        icon={<Building2 className="w-5 h-5 text-muted-foreground" />}
        summary="Se autorellenan en cada contrato"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextLine
            label="Nombre legal / razón social"
            value={p.agency_legal_name}
            onChange={(v) => setP_({ agency_legal_name: v })}
            onBlur={(v) => saveP({ agency_legal_name: v || null })}
            placeholder={`Ej: ${AGENCY_DEFAULTS.legal_name}`}
          />
          <TextLine
            label="RUT"
            value={p.agency_tax_id}
            onChange={(v) => setP_({ agency_tax_id: v })}
            onBlur={(v) => saveP({ agency_tax_id: v || null })}
            placeholder={`Ej: ${AGENCY_DEFAULTS.tax_id}`}
          />
          <TextLine
            label="Dirección"
            value={p.agency_address}
            onChange={(v) => setP_({ agency_address: v })}
            onBlur={(v) => saveP({ agency_address: v || null })}
            placeholder={`Ej: ${AGENCY_DEFAULTS.address}`}
          />
          <TextLine
            label="Email de contacto"
            type="email"
            value={p.agency_email}
            onChange={(v) => setP_({ agency_email: v })}
            onBlur={(v) => saveP({ agency_email: v || null })}
            placeholder="hola@tuagencia.com"
          />
          <TextLine
            label="Jurisdicción (ley aplicable: Chile)"
            value={p.jurisdiction}
            onChange={(v) => setP_({ jurisdiction: v })}
            onBlur={(v) => saveP({ jurisdiction: v || null })}
            placeholder={`Ej: ${AGENCY_DEFAULTS.jurisdiction}`}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Días de plazo de pago</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={p.payment_due_days}
              onChange={(e) => setP_({ payment_due_days: clampDays(e.target.value) })}
              onBlur={(e) => saveP({ payment_due_days: clampDays(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Plazo máximo desde la entrega de cada etapa. Por defecto 30 días.
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Contract clauses */}
      <SettingsSection
        title="Cláusulas del contrato"
        icon={<FileSignature className="w-5 h-5 text-muted-foreground" />}
        summary="Aparecen en todos los contratos"
      >
        <ClauseField
          label="eSIM / teléfono dedicado"
          value={p.clause_esim}
          fallback={CLAUSE_DEFAULTS.clause_esim}
          onChange={(v) => setP_({ clause_esim: v })}
          onSave={(v) => saveP({ clause_esim: v })}
        />
        <ClauseField
          label="Uso responsable Meta API / WhatsApp"
          value={p.clause_meta_api}
          fallback={CLAUSE_DEFAULTS.clause_meta_api}
          onChange={(v) => setP_({ clause_meta_api: v })}
          onSave={(v) => saveP({ clause_meta_api: v })}
        />
        <ClauseField
          label="Mora / suspensión por impago"
          value={p.clause_late_payment}
          fallback={CLAUSE_DEFAULTS.clause_late_payment}
          onChange={(v) => setP_({ clause_late_payment: v })}
          onSave={(v) => saveP({ clause_late_payment: v })}
        />
        <ClauseField
          label="Cláusulas adicionales (opcional)"
          value={p.clause_extra}
          fallback={CLAUSE_DEFAULTS.clause_extra}
          onChange={(v) => setP_({ clause_extra: v })}
          onSave={(v) => saveP({ clause_extra: v })}
        />
      </SettingsSection>

      {/* Notes */}
      <SettingsSection title="Notas internas" summary="No aparecen en el contrato">
        <Textarea
          rows={3}
          value={p.notes ?? ""}
          onChange={(e) => setP_({ notes: e.target.value })}
          onBlur={(e) => saveP({ notes: e.target.value || null })}
          placeholder="Términos internos, descuentos por volumen, recordatorios…"
        />
      </SettingsSection>
    </div>
  );
}

function clampDays(raw: string): number {
  return Math.min(120, Math.max(1, Number(raw || 30)));
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  return (
    <span
      className="flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {state === "saving" && (
        <>
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> Guardando…
        </>
      )}
      {state === "saved" && (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-success-strong" /> Cambios guardados
        </>
      )}
    </span>
  );
}

// NOTE: duplicated in LandingEditor.tsx and MultilinkPage.tsx. Extract to a shared
// component (e.g. components/ui/settings-section.tsx) when adding files is possible.
function SettingsSection({
  title,
  icon,
  summary,
  action,
  defaultOpen,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  summary?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-app-lg border border-border-subtle bg-surface shadow-app-xs">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          {icon}
          <span className="font-semibold truncate">{title}</span>
          {summary && <span className="text-xs text-muted-foreground truncate">{summary}</span>}
          <ChevronDown
            className={`w-4 h-4 shrink-0 ml-auto transition ${open ? "rotate-180" : ""}`}
          />
        </button>
        {action}
      </div>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

function ClauseField({
  label,
  value,
  fallback,
  onChange,
  onSave,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (v: string) => void;
  onSave: (v: string | null) => void;
}) {
  const current = value ?? fallback;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        {value !== null && value !== fallback && fallback && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => {
              onChange(fallback);
              onSave(fallback);
            }}
          >
            Restablecer
          </button>
        )}
      </div>
      <Textarea
        rows={3}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value || null)}
        placeholder={fallback}
      />
    </div>
  );
}
