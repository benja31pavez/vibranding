import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBookingPage, createBooking } from "@/lib/bookings/bookings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CalendarDays, Clock, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
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
  hours: { day: number; enabled: boolean; open: string; close: string; breaks?: { start: string; end: string }[] }[];
  slot_minutes: number;
  timezone: string;
  intro: string | null;
};

const DAY_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const MINI_DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

function sameUTCDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

function buildSlots(date: Date, settings: Settings, taken: Set<string>, viewerTz: string) {
  const idx = (date.getUTCDay() + 6) % 7;
  const h = settings.hours.find((x) => x.day === idx);
  if (!h || !h.enabled) return [];
  const [oh, om] = h.open.split(":").map(Number);
  const [ch, cm] = h.close.split(":").map(Number);
  const breaks = (h.breaks ?? [])
    .filter((b) => b?.start && b?.end)
    .map((b) => {
      const [sH, sM] = b.start.split(":").map(Number);
      const [eH, eM] = b.end.split(":").map(Number);
      return { s: sH * 60 + sM, e: eH * 60 + eM };
    });
  const useViewerTz = viewerTz !== settings.timezone;
  const fmt = new Intl.DateTimeFormat("es-CL", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: viewerTz,
  });
  const slots: { iso: string; label: string; disabled: boolean }[] = [];
  for (let m = oh * 60 + om; m + settings.slot_minutes <= ch * 60 + cm; m += settings.slot_minutes) {
    const s = new Date(date);
    s.setUTCHours(Math.floor(m / 60), m % 60, 0, 0);
    const iso = s.toISOString();
    const inBreak = breaks.some((b) => m < b.e && m + settings.slot_minutes > b.s);
    if (inBreak) continue;
    let label: string;
    if (useViewerTz) {
      label = fmt.format(s).replace(/\s/g, "").toLowerCase().replace("a.m.", "am").replace("p.m.", "pm");
    } else {
      const hour12 = Math.floor(m / 60);
      const min = m % 60;
      const period = hour12 >= 12 ? "pm" : "am";
      const h12 = hour12 % 12 === 0 ? 12 : hour12 % 12;
      label = `${h12}:${String(min).padStart(2, "0")}${period}`;
    }
    slots.push({ iso, label, disabled: taken.has(iso) });
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
  const [viewerTz, setViewerTz] = useState<string>("");

  const minDay = useMemo(() => startOfTomorrowUTC(), []);
  const maxDay = useMemo(() => addDays(minDay, 29), [minDay]);
  const [weekStart, setWeekStart] = useState<Date>(minDay);
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = new Date(minDay);
    d.setUTCDate(1);
    return d;
  });

  useEffect(() => {
    const from = minDay.toISOString();
    const to = addDays(maxDay, 1).toISOString();
    loadPage({ data: { slug, from, to } })
      .then((r) => {
        setSettings(r.settings as any);
        setTaken(new Set(r.taken.map((t) => new Date(t.scheduled_at).toISOString())));
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const miniGrid = useMemo(() => {
    const first = new Date(monthCursor);
    first.setUTCDate(1);
    const offset = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const cells: (Date | null)[] = Array(offset).fill(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), i)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor]);

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

  const goPrevWeek = () => {
    const prev = addDays(weekStart, -7);
    setWeekStart(prev < minDay ? minDay : prev);
  };
  const goNextWeek = () => {
    const next = addDays(weekStart, 7);
    if (next <= maxDay) setWeekStart(next);
  };
  const canPrev = weekStart > minDay;
  const canNext = addDays(weekStart, 7) <= maxDay;

  const prevMonth = () => {
    const d = new Date(monthCursor);
    d.setUTCMonth(d.getUTCMonth() - 1);
    setMonthCursor(d);
  };
  const nextMonth = () => {
    const d = new Date(monthCursor);
    d.setUTCMonth(d.getUTCMonth() + 1);
    setMonthCursor(d);
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-6xl mx-auto">
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
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-medium">Selecciona una hora para la cita</h2>
              <span className="text-xs text-muted-foreground">{settings.timezone}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
              {/* Mini month */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium">
                    {MONTH_NAMES[monthCursor.getUTCMonth()]} de {monthCursor.getUTCFullYear()}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={prevMonth} className="p-1 rounded hover:bg-muted text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={nextMonth} className="p-1 rounded hover:bg-muted text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {MINI_DAY_LABELS.map((l) => (
                    <div key={l} className="text-[10px] text-muted-foreground py-1">{l}</div>
                  ))}
                  {miniGrid.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const disabled = d < minDay || d > maxDay;
                    const selected = sameUTCDay(d, weekStart);
                    const inWeek = weekDays.some((w) => sameUTCDay(w, d));
                    return (
                      <button
                        key={i}
                        disabled={disabled}
                        onClick={() => {
                          setWeekStart(d);
                          setMonthCursor(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
                        }}
                        className={`text-xs h-8 w-8 mx-auto rounded-full flex items-center justify-center transition ${
                          disabled
                            ? "text-muted-foreground/40 line-through cursor-not-allowed"
                            : selected
                            ? "bg-primary text-primary-foreground font-medium"
                            : inWeek
                            ? "bg-primary/10 text-foreground hover:bg-primary/20"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        {d.getUTCDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Week grid */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={goPrevWeek} disabled={!canPrev} className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 text-muted-foreground">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-7 gap-2 flex-1">
                    {weekDays.map((d) => {
                      const isToday = sameUTCDay(d, minDay);
                      return (
                        <div key={d.toISOString()} className="text-center">
                          <div className="text-[10px] text-muted-foreground tracking-wider">{DAY_LABELS[(d.getUTCDay() + 6) % 7]}</div>
                          <div className={`mt-1 mx-auto w-9 h-9 rounded-full flex items-center justify-center text-lg ${
                            isToday ? "bg-primary text-primary-foreground font-medium" : "text-foreground"
                          }`}>
                            {d.getUTCDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={goNextWeek} disabled={!canNext} className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 text-muted-foreground">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((d) => {
                    const outOfRange = d < minDay || d > maxDay;
                    const slots = outOfRange ? [] : buildSlots(d, settings, taken);
                    return (
                      <div key={d.toISOString()} className="space-y-2">
                        {slots.length === 0 ? (
                          <div className="text-center text-muted-foreground py-2">—</div>
                        ) : (
                          slots.map((s) => (
                            <button
                              key={s.iso}
                              onClick={() => !s.disabled && setSelectedISO(s.iso)}
                              disabled={s.disabled}
                              className="w-full px-2 py-2 rounded-full text-sm border border-border text-primary font-medium hover:border-primary hover:bg-primary/5 disabled:opacity-30 disabled:line-through disabled:text-muted-foreground disabled:hover:bg-transparent disabled:hover:border-border transition"
                            >
                              {s.label}
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
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
