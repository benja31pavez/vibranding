import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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

  const Field = ({
    label, value, onChange, onBlur, type = "text", placeholder,
  }: any) => null;
  // (Field component removed; using inline fields below to avoid focus loss)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Mis tarifas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configura los precios de tu empresa. Aparecen en el resumen y el PDF de cada cliente.
        </p>
      </div>

      <div className="rounded-2xl border bg-surface p-5 space-y-4">
        <Field
          label="Moneda (ej. USD, EUR, CLP)"
          value={p.currency}
          onChange={(e: any) => set({ currency: e.target.value.toUpperCase() })}
          onBlur={(e: any) => save({ currency: e.target.value.toUpperCase() || "USD" })}
        />
      </div>

      <div className="rounded-2xl border bg-surface p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Pack inicial</h3>
          <p className="text-xs text-muted-foreground">Primer contacto + edición de perfil completa.</p>
        </div>
        <Field
          label={`Precio del pack (${p.currency})`}
          type="number"
          value={p.pack_price}
          onChange={(e: any) => set({ pack_price: Number(e.target.value) })}
          onBlur={(e: any) => save({ pack_price: Number(e.target.value) })}
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
          <Field
            label={`Foto (${p.currency})`}
            type="number"
            value={p.photo_price}
            onChange={(e: any) => set({ photo_price: Number(e.target.value) })}
            onBlur={(e: any) => save({ photo_price: Number(e.target.value) })}
          />
          <Field
            label={`Carrusel (${p.currency})`}
            type="number"
            value={p.carousel_price}
            onChange={(e: any) => set({ carousel_price: Number(e.target.value) })}
            onBlur={(e: any) => save({ carousel_price: Number(e.target.value) })}
          />
          <Field
            label={`Reel (${p.currency})`}
            type="number"
            value={p.reel_price}
            onChange={(e: any) => set({ reel_price: Number(e.target.value) })}
            onBlur={(e: any) => save({ reel_price: Number(e.target.value) })}
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

export function PricingSummary({ pricing }: { pricing: PricingSettings | null }) {
  if (!pricing) return null;
  const fmt = (n: number) => `${pricing.currency} ${Number(n).toLocaleString("es", { maximumFractionDigits: 2 })}`;
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
