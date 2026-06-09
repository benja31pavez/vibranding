import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBookingPage, createBooking } from "@/lib/bookings/bookings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/book/$slug")({
  component: BookingPage,
  head: ({ params }) => ({
    meta: [
      { title: `Agendar cita · ${params.slug}` },
      { name: "description", content: "Reserva una cita en mi agenda" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">No pudimos cargar la agenda</h1>
        <p className="text-muted-foreground mt-2">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <h1 className="text-2xl font-semibold">Agenda no encontrada</h1>
    </div>
  ),
});

type Settings = {
  id: string;
  display_name: string;
  hours: { day: number; enabled: boolean; open: string; close: string }[];
  slot_minutes: number;
  timezone: string;
  intro: string | null;
};

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function startOfTomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function buildSlots(date: Date, settings: Settings, taken: Set<string>) {
  const idx = (date.getUTCDay() + 6) % 7;
  const h = settings.hours.find((x) => x.day === idx);
  if (!h || !h.enabled) return [];
  const [oh, om] = h.open.split(":").map(Number);
  const [ch, cm] = h.close.split(":").map(Number);
  const slots: { iso: string; label: string; disabled: boolean }[] = [];
  for (let m = oh * 60 + om; m + settings.slot_minutes <= ch * 60 + cm; m += settings.slot_minutes) {
    const s = new Date(date);
    s.setUTCHours(Math.floor(m / 60), m % 60, 0, 0);
    const iso = s.toISOString();
    slots.push({
      iso,
      label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      disabled: taken.has(iso),
    });
  }
  return slots;
}

function BookingPage() {
  const { slug } = Route.useParams();
  const loadPage = useServerFn(getBookingPage);
  const submit = useServerFn(createBooking);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ when: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  const days = useMemo(() => {
    const start = startOfTomorrowUTC();
    return Array.from({ length: 14 }, (_, i) => addDays(start, i));
  }, []);

  useEffect(() => {
    const from = days[0].toISOString();
    const to = addDays(days[days.length - 1], 1).toISOString();
    loadPage({ data: { slug, from, to } })
      .then((r) => {
        setSettings(r.settings as any);
        setTaken(new Set(r.taken.map((t) => new Date(t.scheduled_at).toISOString())));
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">No disponible</h1>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }
  if (!settings) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Cargando…</div>;
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="max-w-lg w-full p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-semibold mt-4">¡Reserva confirmada!</h1>
          <p className="text-muted-foreground mt-2">
            Te esperamos el {new Date(done.when).toLocaleString("es-CL", { dateStyle: "full", timeStyle: "short", timeZone: settings.timezone })}.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Recibirás un correo de confirmación.</p>
        </Card>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedISO) return;
    try {
      setConfirming(true);
      const r = await submit({
        data: {
          slug,
          scheduledAt: selectedISO,
          name: form.name,
          email: form.email,
          phone: form.phone,
          notes: form.notes,
        },
      });
      setDone({ when: r.scheduled_at });
    } catch (e: any) {
      toast.error(e.message ?? "Error al reservar");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-3">
            <CalendarDays className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{settings.display_name}</h1>
          {settings.intro && <p className="text-muted-foreground mt-2 max-w-xl mx-auto">{settings.intro}</p>}
          <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Citas de {settings.slot_minutes} min · zona horaria {settings.timezone}
          </p>
        </header>

        {!selectedISO ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {days.map((d) => {
              const slots = buildSlots(d, settings, taken);
              const label = `${DAY_LABELS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
              return (
                <Card key={d.toISOString()} className="p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
                  {slots.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-3">—</div>
                  ) : (
                    <div className="space-y-1.5">
                      {slots.map((s) => (
                        <button
                          key={s.iso}
                          onClick={() => !s.disabled && setSelectedISO(s.iso)}
                          disabled={s.disabled}
                          className="w-full px-2 py-1.5 rounded-md text-sm border hover:border-primary hover:bg-primary/5 disabled:opacity-40 disabled:line-through disabled:hover:bg-transparent disabled:hover:border-border transition"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="max-w-lg mx-auto p-6">
            <button onClick={() => setSelectedISO(null)} className="text-sm text-muted-foreground hover:text-foreground mb-4">
              ← Cambiar horario
            </button>
            <div className="mb-5">
              <div className="text-sm text-muted-foreground">Horario seleccionado</div>
              <div className="text-lg font-semibold">
                {new Date(selectedISO).toLocaleString("es-CL", { dateStyle: "full", timeStyle: "short", timeZone: settings.timezone })}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Teléfono (opcional)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button onClick={handleSubmit} disabled={confirming || !form.name || !form.email} className="w-full">
                {confirming ? "Confirmando…" : "Confirmar reserva"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
