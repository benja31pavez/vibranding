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
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Trash2, Mail, Plus, X } from "lucide-react";
import { toast } from "sonner";

const TIMEZONES = [
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Atlantic/Canary",
  "UTC",
];

function minutesToHHMM(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function hhmmToMinutes(s: string) {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function TimeSlider({
  value,
  onChange,
  onCommit,
  disabled,
  min = 0,
  max = 1440,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <span className="text-xs font-mono tabular-nums w-12 text-right">{minutesToHHMM(value)}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={30}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
        onValueCommit={(v) => onCommit(v[0])}
        className="flex-1"
      />
    </div>
  );
}


type Settings = {
  id: string;
  slug: string;
  display_name: string;
  hours: { day: number; enabled: boolean; open: string; close: string; breaks?: { start: string; end: string }[] }[];
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

export function BookingsPanel() {
  const { user } = useAuth();
  const ensure = useServerFn(ensureBookingSettings);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [draftHours, setDraftHours] = useState<Settings["hours"] | null>(null);
  const [savingHours, setSavingHours] = useState(false);

  const load = async () => {
    if (!user) return;
    const s = await ensure({ data: { clientId: null } });
    setSettings(s as unknown as Settings);
    setDraftHours((s as unknown as Settings).hours);
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

  if (!settings || !draftHours) return <div className="p-6 text-muted-foreground text-sm">Cargando agenda…</div>;

  const save = async (patch: Partial<Settings>) => {
    const { error } = await supabase
      .from("booking_settings")
      .update(patch as any)
      .eq("id", settings.id);
    if (error) return toast.error(error.message);
    setSettings({ ...settings, ...patch });
    toast.success("Guardado");
  };

  const hoursDirty = JSON.stringify(draftHours) !== JSON.stringify(settings.hours);

  const saveHours = async () => {
    setSavingHours(true);
    const { error } = await supabase
      .from("booking_settings")
      .update({ hours: draftHours as any })
      .eq("id", settings.id);
    setSavingHours(false);
    if (error) return toast.error(error.message);
    setSettings({ ...settings, hours: draftHours });
    toast.success("Horario guardado");
  };

  const resetHours = () => setDraftHours(settings.hours);

  const setHour = (day: number, field: "enabled" | "open" | "close", value: any) => {
    setDraftHours(draftHours.map((h) => (h.day === day ? { ...h, [field]: value } : h)));
  };
  const addBreak = (day: number) => {
    setDraftHours(draftHours.map((h) =>
      h.day === day ? { ...h, breaks: [...(h.breaks ?? []), { start: "13:00", end: "14:00" }] } : h,
    ));
  };
  const updateBreak = (day: number, idx: number, field: "start" | "end", value: string) => {
    setDraftHours(draftHours.map((h) =>
      h.day === day
        ? { ...h, breaks: (h.breaks ?? []).map((b, i) => (i === idx ? { ...b, [field]: value } : b)) }
        : h,
    ));
  };
  const removeBreak = (day: number, idx: number) => {
    setDraftHours(draftHours.map((h) =>
      h.day === day ? { ...h, breaks: (h.breaks ?? []).filter((_, i) => i !== idx) } : h,
    ));
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
    <div className="space-y-6">
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
              min={30}
              step={15}
              defaultValue={settings.slot_minutes}
              onBlur={(e) => {
                const v = parseInt(e.target.value);
                if (v && v !== settings.slot_minutes) save({ slot_minutes: v });
              }}
            />
          </div>
          <div className="hidden" />

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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Label className="text-base">Horario semanal</Label>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Zona horaria:</span>
                <Select value={settings.timezone} onValueChange={(v) => save({ timezone: v })}>
                  <SelectTrigger className="h-7 w-[220px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(TIMEZONES.includes(settings.timezone) ? TIMEZONES : [settings.timezone, ...TIMEZONES]).map((tz) => (
                      <SelectItem key={tz} value={tz} className="text-xs">{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Las horas se expresan en esta zona horaria. Los bloques son de 30 minutos (ej. 09:00–09:30). Desactiva los días sin reuniones. Recuerda guardar.</p>
            </div>
            <div className="flex items-center gap-2">
              {hoursDirty && (
                <Button type="button" size="sm" variant="ghost" onClick={resetHours} disabled={savingHours}>
                  Descartar
                </Button>
              )}
              <Button type="button" size="sm" onClick={saveHours} disabled={!hoursDirty || savingHours}>
                {savingHours ? "Guardando…" : hoursDirty ? "Guardar horario" : "Guardado"}
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {draftHours.map((h) => {
              const openM = hhmmToMinutes(h.open);
              const closeM = hhmmToMinutes(h.close);
              return (
                <div key={h.day} className={`border rounded-lg p-3 space-y-3 ${!h.enabled ? "bg-muted/30" : ""}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-12 text-sm font-medium">{DAYS[h.day]}</div>
                    <Switch checked={h.enabled} onCheckedChange={(v) => setHour(h.day, "enabled", v)} />
                    {h.enabled ? (
                      <>
                        <div className="flex-1 min-w-[260px] grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">Inicio</div>
                            <TimeSlider
                              value={openM}
                              onChange={(v) => setHour(h.day, "open", minutesToHHMM(Math.min(v, closeM - 30)))}
                              onCommit={(v) => setHour(h.day, "open", minutesToHHMM(Math.min(v, closeM - 30)))}
                              max={1410}
                            />
                          </div>
                          <div>
                            <div className="text-[11px] text-muted-foreground mb-1">Fin</div>
                            <TimeSlider
                              value={closeM}
                              onChange={(v) => setHour(h.day, "close", minutesToHHMM(Math.max(v, openM + 30)))}
                              onCommit={(v) => setHour(h.day, "close", minutesToHHMM(Math.max(v, openM + 30)))}
                              min={30}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => addBreak(h.day)}
                          className="ml-auto"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Pausa
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sin reuniones este día</span>
                    )}
                  </div>
                  {h.enabled && (h.breaks ?? []).length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      {(h.breaks ?? []).map((b, i) => {
                        const bs = hhmmToMinutes(b.start);
                        const be = hhmmToMinutes(b.end);
                        return (
                          <div key={i} className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-muted-foreground w-12">Pausa</span>
                            <div className="flex-1 min-w-[260px] grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <TimeSlider
                                value={bs}
                                onChange={(v) => updateBreak(h.day, i, "start", minutesToHHMM(Math.min(v, be - 30)))}
                                onCommit={(v) => updateBreak(h.day, i, "start", minutesToHHMM(Math.min(v, be - 30)))}
                                max={1410}
                              />
                              <TimeSlider
                                value={be}
                                onChange={(v) => updateBreak(h.day, i, "end", minutesToHHMM(Math.max(v, bs + 30)))}
                                onCommit={(v) => updateBreak(h.day, i, "end", minutesToHHMM(Math.max(v, bs + 30)))}
                                min={30}
                              />
                            </div>
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeBreak(h.day, i)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
