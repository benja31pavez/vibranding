import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ensureBookingSettings } from "@/lib/bookings/bookings.functions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

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

export function UpcomingBookings() {
  const { user } = useAuth();
  const ensure = useServerFn(ensureBookingSettings);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [bookings, setBookings] = useState<Booking[]>([]);

  const load = async () => {
    if (!user) return;
    const s = await ensure({ data: { clientId: null } });
    setTimezone((s as any).timezone ?? "UTC");
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("owner_user_id", user.id)
      .is("client_id", null)
      .order("scheduled_at", { ascending: true });
    setBookings((data ?? []) as Booking[]);
  };

  useEffect(() => {
    load();
  }, [user]);

  const upcoming = bookings.filter((b) => new Date(b.scheduled_at) >= new Date() && b.status !== "cancelled");
  const past = bookings.filter((b) => new Date(b.scheduled_at) < new Date());

  const cancel = async (id: string) => {
    if (!confirm("¿Cancelar esta reserva?")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Próximas reservas ({upcoming.length})</h3>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no hay reservas.</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((b) => (
            <li key={b.id} className="rounded-lg border p-2 text-xs">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {new Date(b.scheduled_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: timezone })}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {b.customer_name} · {b.customer_email}
                  </div>
                  {b.notes && <div className="text-muted-foreground mt-0.5 italic truncate">"{b.notes}"</div>}
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => cancel(b.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-muted-foreground cursor-pointer">Pasadas ({past.length})</summary>
          <ul className="space-y-1 mt-2">
            {past.map((b) => (
              <li key={b.id} className="rounded-lg border p-2 text-xs opacity-70">
                <div>{new Date(b.scheduled_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: timezone })}</div>
                <div className="text-muted-foreground truncate">{b.customer_name}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
