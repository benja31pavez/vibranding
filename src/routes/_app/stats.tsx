import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, MousePointerClick } from "lucide-react";

export const Route = createFileRoute("/_app/stats")({
  component: StatsPage,
});

type Row = { event_name: string; lang: string | null; path: string | null; referrer: string | null; created_at: string };

function StatsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("landing_events")
      .select("event_name,lang,path,referrer,created_at")
      .eq("source_type", "site")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, []);

  const now = Date.now();
  const since = (days: number) => now - days * 86400000;
  const count = (name: string, days?: number) =>
    rows.filter((r) => r.event_name === name && (!days || new Date(r.created_at).getTime() >= since(days))).length;

  const cards = [
    { key: "contact_click", label: "Clics en “Contacto”", icon: MousePointerClick },
    { key: "whatsapp_click", label: "Clics en WhatsApp", icon: MessageCircle },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Estadísticas del landing</h1>
      <p className="text-muted-foreground mt-2">Clics registrados desde la landing pública.</p>

      {loading ? (
        <div className="mt-10 text-muted-foreground">Cargando…</div>
      ) : (
        <>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {cards.map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">{label}</div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <Stat label="Total" value={count(key)} />
                  <Stat label="Últimos 30d" value={count(key, 30)} />
                  <Stat label="Últimos 7d" value={count(key, 7)} />
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-lg font-semibold">Últimos clics</h2>
          <div className="mt-4 rounded-2xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Evento</th>
                  <th className="text-left px-4 py-2 font-medium">Idioma</th>
                  <th className="text-left px-4 py-2 font-medium">Ruta</th>
                  <th className="text-left px-4 py-2 font-medium">Origen</th>
                  <th className="text-left px-4 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{r.event_name === "whatsapp_click" ? "WhatsApp" : "Contacto"}</td>
                    <td className="px-4 py-2 uppercase">{r.lang ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{r.path ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{r.referrer || "directo"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aún no hay clics registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/30 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
