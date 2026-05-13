import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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

export interface PricingSettings {
  id: string;
  user_id: string;
  currency: string;
  pack_price: number;
  pack_description: string | null;
  photo_price: number;
  carousel_price: number;
  reel_price: number;
  notes: string | null;
}

export async function loadPricing(userId: string): Promise<PricingSettings | null> {
  const { data } = await supabase
    .from("pricing_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as PricingSettings;
  const { data: created } = await supabase
    .from("pricing_settings")
    .insert({ user_id: userId })
    .select("*")
    .single();
  return (created as PricingSettings) ?? null;
}

function TextLine({
  label, value, onChange, onBlur, type = "text", placeholder,
}: {
  label: string;
  value: string | number;
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
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      />
    </div>
  );
}

export function PricingPanel() {
  const { user } = useAuth();
  const [p, setP] = useState<PricingSettings | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPricing(user.id).then(setP);
  }, [user]);

  if (!p) return <div className="text-muted-foreground">Cargando…</div>;

  const set = (patch: Partial<PricingSettings>) => setP({ ...p, ...patch });
  const save = async (patch: Partial<PricingSettings>) => {
    const { error } = await supabase.from("pricing_settings").update(patch).eq("id", p.id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Mis tarifas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configura los precios de tu empresa. Aparecen en el resumen y el PDF de cada cliente.
        </p>
      </div>

      <div className="rounded-2xl border bg-surface p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Moneda</Label>
          <Select
            value={p.currency}
            onValueChange={(v) => {
              set({ currency: v });
              save({ currency: v });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una moneda" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border bg-surface p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Pack inicial</h3>
          <p className="text-xs text-muted-foreground">Primer contacto + edición de perfil completa.</p>
        </div>
        <TextLine
          label={`Precio del pack (${p.currency})`}
          type="number"
          value={p.pack_price}
          onChange={(v) => set({ pack_price: Number(v) })}
          onBlur={(v) => save({ pack_price: Number(v) })}
        />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Qué incluye (opcional)</Label>
          <Textarea
            rows={3}
            value={p.pack_description ?? ""}
            onChange={(e) => set({ pack_description: e.target.value })}
            onBlur={(e) => save({ pack_description: e.target.value || null })}
            placeholder="Ej: Auditoría inicial, propuesta de bio, foto de perfil, paleta visual…"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-surface p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Publicaciones adicionales</h3>
          <p className="text-xs text-muted-foreground">Costo unitario por pieza extra fuera del pack.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextLine
            label={`Foto (${p.currency})`}
            type="number"
            value={p.photo_price}
            onChange={(v) => set({ photo_price: Number(v) })}
            onBlur={(v) => save({ photo_price: Number(v) })}
          />
          <TextLine
            label={`Carrusel (${p.currency})`}
            type="number"
            value={p.carousel_price}
            onChange={(v) => set({ carousel_price: Number(v) })}
            onBlur={(v) => save({ carousel_price: Number(v) })}
          />
          <TextLine
            label={`Reel (${p.currency})`}
            type="number"
            value={p.reel_price}
            onChange={(v) => set({ reel_price: Number(v) })}
            onBlur={(v) => save({ reel_price: Number(v) })}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-surface p-5 space-y-2">
        <Label className="text-xs text-muted-foreground">Notas adicionales</Label>
        <Textarea
          rows={3}
          value={p.notes ?? ""}
          onChange={(e) => set({ notes: e.target.value })}
          onBlur={(e) => save({ notes: e.target.value || null })}
          placeholder="Términos, descuentos por volumen, etc."
        />
      </div>
    </div>
  );
}

function fmtMoney(pricing: PricingSettings, n: number) {
  return `${pricing.currency} ${Number(n).toLocaleString("es", { maximumFractionDigits: 2 })}`;
}

export function PricingSummary({ pricing }: { pricing: PricingSettings | null }) {
  if (!pricing) return null;
  const fmt = (n: number) => fmtMoney(pricing, n);
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold">Tarifas</h3>
        <span className="text-xs text-muted-foreground">{pricing.currency}</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between border-b pb-2">
          <div>
            <div className="font-medium">Pack inicial</div>
            {pricing.pack_description && (
              <div className="text-xs text-muted-foreground whitespace-pre-line mt-0.5">{pricing.pack_description}</div>
            )}
          </div>
          <div className="font-semibold">{fmt(pricing.pack_price)}</div>
        </div>
        <div className="flex justify-between"><span>Foto adicional</span><span className="font-medium">{fmt(pricing.photo_price)}</span></div>
        <div className="flex justify-between"><span>Carrusel adicional</span><span className="font-medium">{fmt(pricing.carousel_price)}</span></div>
        <div className="flex justify-between"><span>Reel adicional</span><span className="font-medium">{fmt(pricing.reel_price)}</span></div>
        {pricing.notes && (
          <div className="text-xs text-muted-foreground pt-2 border-t mt-2 whitespace-pre-line">{pricing.notes}</div>
        )}
      </div>
    </div>
  );
}

import type { IGPost, PostFormat } from "./InstagramEditor";

export function priceForFormat(pricing: PricingSettings, f: PostFormat): number {
  return f === "reel" ? pricing.reel_price : f === "carousel" ? pricing.carousel_price : pricing.photo_price;
}

export function ProposedCostsBreakdown({
  pricing, posts,
}: {
  pricing: PricingSettings | null;
  posts: IGPost[];
}) {
  if (!pricing) return null;
  const proposed = posts
    .filter((p) => p.type === "proposed")
    .sort((a, b) => a.position - b.position);
  if (!proposed.length) return null;
  const fmt = (n: number) => fmtMoney(pricing, n);
  const subtotal = proposed.reduce((s, p) => s + priceForFormat(pricing, p.format), 0);
  const total = subtotal + Number(pricing.pack_price ?? 0);

  const label = (f: PostFormat) => f === "reel" ? "Reel" : f === "carousel" ? "Carrusel" : "Foto";

  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold">Desglose de costos · Propuesta</h3>
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
        <div className="flex justify-between pt-2 border-t mt-2">
          <span>Subtotal posts</span>
          <span className="font-medium">{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Pack inicial</span>
          <span className="font-medium">{fmt(pricing.pack_price)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t mt-1 text-base">
          <span className="font-semibold">Total estimado</span>
          <span className="font-bold">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}
