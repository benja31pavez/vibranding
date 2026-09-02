import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Sparkles,
  Search,
  Camera,
  Megaphone,
  MonitorSmartphone,
  MessageCircle,
  FileSignature,
  Building2,
  ChevronDown,
} from "lucide-react";

const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD · Dólar estadounidense" },
  { code: "EUR", label: "EUR · Euro" },
  { code: "CLP", label: "CLP · Peso chileno" },
  { code: "MXN", label: "MXN · Peso mexicano" },
  { code: "ARS", label: "ARS · Peso argentino" },
  { code: "COP", label: "COP · Peso colombiano" },
  { code: "PEN", label: "PEN · Sol peruano" },
  { code: "BRL", label: "BRL · Real brasileño" },
  { code: "GBP", label: "GBP · Libra esterlina" },
  { code: "UYU", label: "UYU · Peso uruguayo" },
];

export type ServiceKey = "branding" | "optimization" | "content" | "ads" | "landing" | "chatbot";

export const SERVICE_CATALOG: Array<{ key: ServiceKey; label: string; description: string; icon: any; tone: string }> =
  [
    {
      key: "branding",
      label: "Branding",
      description: "Identidad visual, tono y estrategia clara.",
      icon: Sparkles,
      tone: "var(--brand-1)",
    },
    {
      key: "optimization",
      label: "Optimización",
      description: "Perfil de Instagram y presencia digital optimizados.",
      icon: Search,
      tone: "var(--brand-2)",
    },
    {
      key: "content",
      label: "Contenido",
      description: "Calendario, fotografía y copy semanal.",
      icon: Camera,
      tone: "var(--brand-3)",
    },
    {
      key: "ads",
      label: "Anuncios",
      description: "Campañas Meta Ads para captar nuevas audiencias.",
      icon: Megaphone,
      tone: "var(--brand-1)",
    },
    {
      key: "landing",
      label: "Landing Page",
      description: "Página clara que convierte curiosidad en interés real.",
      icon: MonitorSmartphone,
      tone: "var(--brand-2)",
    },
    {
      key: "chatbot",
      label: "Chatbot",
      description: "WhatsApp dedicado con chatbot que califica y cierra.",
      icon: MessageCircle,
      tone: "var(--brand-3)",
    },
  ];

// ───────── Types ─────────

export interface PricingSettings {
  id: string;
  user_id: string;
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
  const { data, error } = await supabase.from("pricing_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as PricingSettings;
  const { data: created, error: insertError } = await supabase
    .from("pricing_settings")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return (created as PricingSettings) ?? null;
}

export async function loadServicePricing(userId: string): Promise<Record<ServiceKey, ServicePricing>> {
  const { data, error } = await supabase.from("service_pricing").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const byKey: Partial<Record<ServiceKey, ServicePricing>> = {};
  (data ?? []).forEach((row: any) => {
    byKey[row.service_key as ServiceKey] = row as ServicePricing;
  });

  // Seed any missing catalog rows in a single round trip instead of six.
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

function MoneyInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onBlur: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={Number.isFinite(value) ? String(value) : ""}
        placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value || 0)))}
        onBlur={(e) => onBlur(Math.max(0, Number(e.target.value || 0)))}
      />
    </div>
  );
}

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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadError(null);
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
  }, [user]);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 max-w-lg">
        <div className="font-semibold text-sm">No se pudieron cargar tus servicios</div>
        <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
      </div>
    );
  }
  if (!p || !services) return <div className="text-muted-foreground">Cargando…</div>;

  const flashSaved = () => {
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1600);
  };

  const setP_ = (patch: Partial<PricingSettings>) => setP({ ...p, ...patch });
  const saveP = async (patch: Partial<PricingSettings>) => {
    setSaveState("saving");
    const { data, error } = await supabase.from("pricing_settings").update(patch).eq("id", p.id).select("id");
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
    const { data, error } = await supabase.from("service_pricing").update(patch).eq("id", id).select("id");
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
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            <span className="font-brand text-gradient-brand bg-gradient-brand-animated">Servicios</span>
          </h1>
          <SaveIndicator state={saveState} />
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Define el precio estándar de cada uno de los 6 servicios. Estos valores son los mismos para todos tus clientes
          y se usan al generar contratos.
        </p>
      </div>

      {/* Currency */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-xs text-muted-foreground">Moneda por defecto</Label>
          <Select
            value={p.currency}
            onValueChange={(v) => {
              setP_({ currency: v });
              saveP({ currency: v });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una moneda" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 6 Services */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Catálogo estandarizado</h2>
          <span className="text-xs text-muted-foreground">Setup = pago único · Mensualidad = recurrente</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERVICE_CATALOG.map((svc) => {
            const row = services[svc.key];
            const Icon = svc.icon;
            return (
              <div
                key={svc.key}
                className={`rounded-2xl border bg-card p-5 space-y-4 transition-shadow hover:shadow-md ${row.is_active ? "" : "opacity-55"}`}
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
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{svc.description}</p>
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

                <div className="grid grid-cols-2 gap-3">
                  <MoneyInput
                    label={`Setup (${p.currency})`}
                    value={Number(row.one_time_price)}
                    onChange={(v) => updateService(svc.key, { one_time_price: v })}
                    onBlur={(v) => saveService(row.id, { one_time_price: v })}
                  />
                  <MoneyInput
                    label={`Mensual (${p.currency})`}
                    value={Number(row.monthly_price)}
                    onChange={(v) => updateService(svc.key, { monthly_price: v })}
                    onBlur={(v) => saveService(row.id, { monthly_price: v })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Qué incluye
                  </Label>
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
        <ServiceTotals services={services} currency={p.currency} />
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
            placeholder="Ej: Vibranding S.L."
          />
          <TextLine
            label="Identificación fiscal (NIF/CIF/RUT…)"
            value={p.agency_tax_id}
            onChange={(v) => setP_({ agency_tax_id: v })}
            onBlur={(v) => saveP({ agency_tax_id: v || null })}
            placeholder="Ej: B12345678"
          />
          <TextLine
            label="Dirección"
            value={p.agency_address}
            onChange={(v) => setP_({ agency_address: v })}
            onBlur={(v) => saveP({ agency_address: v || null })}
            placeholder="Calle, ciudad, país"
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
            label="Jurisdicción / ley aplicable"
            value={p.jurisdiction}
            onChange={(v) => setP_({ jurisdiction: v })}
            onBlur={(v) => saveP({ jurisdiction: v || null })}
            placeholder="Ej: Tribunales de Madrid, España"
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
            <p className="text-[11px] text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">
          Cada cláusula aparece en todos los contratos. Puedes editar su texto.
        </p>

        <ClauseField
          label="eSIM / teléfono dedicado"
          value={p.clause_esim}
          fallback="El cliente asume el coste del número WhatsApp (eSIM o línea dedicada) destinado al chatbot. El servicio queda condicionado a que dicho número esté activo y al día."
          onChange={(v) => setP_({ clause_esim: v })}
          onSave={(v) => saveP({ clause_esim: v })}
        />
        <ClauseField
          label="Uso responsable Meta API / WhatsApp"
          value={p.clause_meta_api}
          fallback="El cliente se compromete a no enviar spam, contenido engañoso ni cualquier material que vulnere las políticas de Meta. Cualquier sanción derivada de un uso indebido será de su exclusiva responsabilidad y podrá suponer la suspensión inmediata del servicio."
          onChange={(v) => setP_({ clause_meta_api: v })}
          onSave={(v) => saveP({ clause_meta_api: v })}
        />
        <ClauseField
          label="Mora / suspensión por impago"
          value={p.clause_late_payment}
          fallback="Si el pago no se realiza dentro del plazo acordado, la agencia podrá suspender todos los servicios activos sin previo aviso y hasta la regularización del importe pendiente, sin que ello exima al cliente del pago."
          onChange={(v) => setP_({ clause_late_payment: v })}
          onSave={(v) => saveP({ clause_late_payment: v })}
        />
        <ClauseField
          label="Cláusulas adicionales (opcional)"
          value={p.clause_extra}
          fallback=""
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
  if (state === "idle") return null;
  return (
    <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
      {state === "saving" ? "Guardando…" : "Guardado"}
    </span>
  );
}

function ServiceTotals({ services, currency }: { services: Record<ServiceKey, ServicePricing>; currency: string }) {
  const active = SERVICE_CATALOG.filter((s) => services[s.key]?.is_active);
  const setup = active.reduce((n, s) => n + Number(services[s.key].one_time_price || 0), 0);
  const monthly = active.reduce((n, s) => n + Number(services[s.key].monthly_price || 0), 0);
  const unpriced = active.filter(
    (s) => Number(services[s.key].one_time_price) === 0 && Number(services[s.key].monthly_price) === 0,
  );

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="font-semibold">Si un cliente contrata todo</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suma de los {active.length} servicios activos · primer mes {fmtMoney(currency, setup + monthly)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{fmtMoney(currency, setup)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">+ {fmtMoney(currency, monthly)}/mes</div>
        </div>
      </div>
      {unpriced.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-3 border-t pt-3">
          Todavía sin precio: {unpriced.map((s) => s.label).join(", ")}.
        </p>
      )}
    </div>
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
    <div className="rounded-2xl border bg-card">
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
          <ChevronDown className={`w-4 h-4 shrink-0 ml-auto transition ${open ? "rotate-180" : ""}`} />
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
            className="text-[11px] text-muted-foreground underline hover:text-foreground"
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

// ───────── Money helpers + IG breakdown (kept for legacy callers) ─────────

function fmtMoney(currency: string, n: number) {
  return `${currency} ${Number(n).toLocaleString("es", { maximumFractionDigits: 2 })}`;
}

export function PricingSummary({
  pricing,
  services,
}: {
  pricing: PricingSettings | null;
  services?: Record<ServiceKey, ServicePricing> | null;
}) {
  if (!pricing) return null;
  const fmt = (n: number) => fmtMoney(pricing.currency, n);
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold">Servicios estándar</h3>
        <span className="text-xs text-muted-foreground">{pricing.currency}</span>
      </div>
      <div className="space-y-2 text-sm">
        {services
          ? SERVICE_CATALOG.map((s) => {
              const row = services[s.key];
              if (!row || (Number(row.one_time_price) === 0 && Number(row.monthly_price) === 0)) return null;
              return (
                <div key={s.key} className="flex justify-between border-b last:border-0 py-1.5">
                  <div className="min-w-0">
                    <div className="font-medium">{s.label}</div>
                    {row.included_text && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{row.included_text}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {Number(row.one_time_price) > 0 && (
                      <div className="font-semibold">{fmt(Number(row.one_time_price))}</div>
                    )}
                    {Number(row.monthly_price) > 0 && (
                      <div className="text-xs text-muted-foreground">{fmt(Number(row.monthly_price))}/mes</div>
                    )}
                  </div>
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}

import type { IGPost, PostFormat } from "./InstagramEditor";

export function priceForFormat(pricing: PricingSettings, f: PostFormat): number {
  return f === "reel" ? pricing.reel_price : f === "carousel" ? pricing.carousel_price : pricing.photo_price;
}

export function ProposedCostsBreakdown({ pricing, posts }: { pricing: PricingSettings | null; posts: IGPost[] }) {
  if (!pricing) return null;
  const proposed = posts.filter((p) => p.type === "proposed").sort((a, b) => a.position - b.position);
  if (!proposed.length) return null;
  const fmt = (n: number) => fmtMoney(pricing.currency, n);
  const subtotal = proposed.reduce((s, p) => s + priceForFormat(pricing, p.format), 0);

  const label = (f: PostFormat) => (f === "reel" ? "Reel" : f === "carousel" ? "Carrusel" : "Foto");

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold">Desglose por publicación</h3>
        <span className="text-xs text-muted-foreground">{pricing.currency}</span>
      </div>
      <div className="space-y-1.5 text-sm">
        {proposed.map((p, i) => (
          <div key={p.id} className="flex justify-between py-1 border-b last:border-0">
            <span className="text-muted-foreground">
              Post #{i + 1} · <span className="text-foreground">{label(p.format)}</span>
            </span>
            <span className="font-medium">{fmt(priceForFormat(pricing, p.format))}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 border-t mt-2 text-base">
          <span className="font-semibold">Subtotal publicaciones</span>
          <span className="font-bold">{fmt(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
