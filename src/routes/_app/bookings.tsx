import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ensureBookingSettings } from "@/lib/bookings/bookings.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Copy, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bookings")({
  component: BookingsPage,
});

type Settings = {
  id: string;
  slug: string;
  display_name: string;
  hours: { day: number; enabled: boolean; open: string; close: string }[];
  slot_minutes: number;
  timezone: string;
  notification_email: string | null;
  enabled: boolean;
  intro: string | null;
  client_id: string | null;
};

type Booking = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  notes: string | null;
  status: string;
  client_id: string | null;
};

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function BookingsPage() {
  const { user } = useAuth();
  const ensure = useServerFn(ensureBookingSettings);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const s = await ensure({ data: { clientId: null } });
    setSettings(s as Settings);
    const { data: bs } = await supabase
      .from("bookings")
      .select("*")
      .eq("owner_user_id", user.id)
      .is("client_id", null)
      .order("scheduled_at", { ascending: true });
    setBookings((bs ?? []) as Booking[]);
  };

  useEffect(() => {
    load();
  }, [user]);

  if (!settings) return <div className="p-10 text-muted-foreground">Cargando…</div>;

  const save = async (patch: Partial<Settings>) => {
    setSaving(true);
    const { error } = await supabase
      .from("booking_settings")
      .update(patch as any)
      .eq("id", settings.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setSettings({ ...settings, ...patch });
    toast.success("Guardado");
  };

  const setHour = (day: number, field: "enabled" | "open" | "close", value: any) => {
    const hours = settings.hours.map((h) => (h.day === day ? { ...h, [field]: value } : h));
    save({ hours });
  };

  const publicUrl = `${window.location.origin}/book/${settings.slug}`;

  const upcoming = bookings.filter((b) => new Date(b.scheduled_at) >= new Date());
  const past = bookings.filter((b) => new Date(b.scheduled_at) < new Date());

  const cancel = async (id: string) => {
    if (!confirm("¿Cancelar esta reserva?")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <CalendarDays className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">Comparte tu link público y revisa las reservas entrantes.</p>
        </div>
      </header>

      <Card className="p-6">
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Tu link de reservas</div>
            <div className="flex items-center gap-2">
              <Input readOnly value={publicUrl} />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">Ver</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Los clientes solo pueden agendar a partir de mañana, hasta 30 días en adelante.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={settings.enabled} onCheckedChange={(v) => save({ enabled: v })} />
            <span className="text-sm">{settings.enabled ? "Activa" : "Desactivada"}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <Label className="text-base">Configuración</Label>
          <p className="text-sm text-muted-foreground">Personaliza el nombre, mensaje, horarios y duración.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Nombre visible</Label>
            <Input
              defaultValue={settings.display_name}
              onBlur={(e) => e.target.value !== settings.display_name && save({ display_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email para alertas</Label>
            <Input
              type="email"
              placeholder="tucorreo@dominio.com"
              defaultValue={settings.notification_email ?? user?.email ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== settings.notification_email) save({ notification_email: v });
              }}
            />
          </div>
          <div>
            <Label>Duración por cita (min)</Label>
            <Input
              type="number"
              min={15}
              step={15}
              defaultValue={settings.slot_minutes}
              onBlur={(e) => {
                const v = parseInt(e.target.value);
                if (v && v !== settings.slot_minutes) save({ slot_minutes: v });
              }}
            />
          </div>
          <div>
            <Label>Zona horaria</Label>
            <Input
              defaultValue={settings.timezone}
              onBlur={(e) => e.target.value !== settings.timezone && save({ timezone: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Mensaje introductorio (opcional)</Label>
            <Textarea
              rows={2}
              defaultValue={settings.intro ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== settings.intro) save({ intro: v });
              }}
            />
          </div>
        </div>

        <div>
          <Label className="text-base">Horario semanal</Label>
          <div className="mt-3 space-y-2">
            {settings.hours.map((h) => (
              <div key={h.day} className="flex items-center gap-3">
                <div className="w-12 text-sm font-medium">{DAYS[h.day]}</div>
                <Switch checked={h.enabled} onCheckedChange={(v) => setHour(h.day, "enabled", v)} />
                <Input
                  type="time"
                  value={h.open}
                  onChange={(e) => setHour(h.day, "open", e.target.value)}
                  className="w-32"
                  disabled={!h.enabled}
                />
                <span className="text-muted-foreground">a</span>
                <Input
                  type="time"
                  value={h.close}
                  onChange={(e) => setHour(h.day, "close", e.target.value)}
                  className="w-32"
                  disabled={!h.enabled}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Próximas reservas ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay reservas.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {new Date(b.scheduled_at).toLocaleString("es-CL", { dateStyle: "full", timeStyle: "short", timeZone: settings.timezone })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {b.customer_name} · {b.customer_email}{b.customer_phone ? ` · ${b.customer_phone}` : ""}
                  </div>
                  {b.notes && <div className="text-xs text-muted-foreground mt-1">"{b.notes}"</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => cancel(b.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {past.length > 0 && (
          <details className="mt-6">
            <summary className="text-sm text-muted-foreground cursor-pointer">Reservas pasadas ({past.length})</summary>
            <div className="space-y-2 mt-3">
              {past.map((b) => (
                <div key={b.id} className="flex items-center gap-4 p-3 border rounded-lg opacity-70">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{new Date(b.scheduled_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: settings.timezone })}</div>
                    <div className="text-xs text-muted-foreground">{b.customer_name} · {b.customer_email}</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </Card>
    </div>
  );
}
