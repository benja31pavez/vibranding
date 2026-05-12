import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

interface Row {
  client_id: string;
  client_name: string;
  posts: number;
  likes: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  paid: number;
  pending: number;
  currency: string;
}

function ReportsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: clients } = await supabase.from("clients").select("id,name");
      const list = clients ?? [];
      const ids = list.map((c) => c.id);
      if (!ids.length) return setRows([]);

      const [{ data: posts }, { data: ins }, { data: pays }] = await Promise.all([
        supabase.from("instagram_posts").select("client_id,likes_count").in("client_id", ids),
        supabase.from("meta_ads_insights").select("client_id,spend,impressions,clicks,conversions").in("client_id", ids),
        supabase.from("payments").select("client_id,amount,status,currency").in("client_id", ids),
      ]);

      const result: Row[] = list.map((c) => {
        const p = (posts ?? []).filter((x: any) => x.client_id === c.id);
        const i = (ins ?? []).filter((x: any) => x.client_id === c.id);
        const pay = (pays ?? []).filter((x: any) => x.client_id === c.id);
        return {
          client_id: c.id,
          client_name: c.name,
          posts: p.length,
          likes: p.reduce((s: number, x: any) => s + Number(x.likes_count || 0), 0),
          spend: i.reduce((s: number, x: any) => s + Number(x.spend || 0), 0),
          impressions: i.reduce((s: number, x: any) => s + Number(x.impressions || 0), 0),
          clicks: i.reduce((s: number, x: any) => s + Number(x.clicks || 0), 0),
          conversions: i.reduce((s: number, x: any) => s + Number(x.conversions || 0), 0),
          paid: pay.filter((x: any) => x.status === "paid").reduce((s: number, x: any) => s + Number(x.amount), 0),
          pending: pay.filter((x: any) => x.status !== "paid" && x.status !== "cancelled").reduce((s: number, x: any) => s + Number(x.amount), 0),
          currency: pay[0]?.currency ?? "USD",
        };
      });
      setRows(result);
    })();
  }, [user]);

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      posts: acc.posts + r.posts,
      likes: acc.likes + r.likes,
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      conversions: acc.conversions + r.conversions,
      paid: acc.paid + r.paid,
      pending: acc.pending + r.pending,
    }),
    { posts: 0, likes: 0, spend: 0, impressions: 0, clicks: 0, conversions: 0, paid: 0, pending: 0 },
  );
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;

  const Card = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">Métricas agregadas por cliente y totales.</p>
      </header>

      {!rows ? (
        <div className="text-muted-foreground text-sm">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground text-sm">Aún no hay clientes.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Publicaciones" value={String(totals.posts)} />
            <Card label="Likes IG" value={totals.likes.toLocaleString()} />
            <Card label="Inversión Ads" value={`$${totals.spend.toFixed(0)}`} />
            <Card label="CTR" value={`${ctr.toFixed(2)}%`} />
            <Card label="Impresiones" value={totals.impressions.toLocaleString()} />
            <Card label="Clicks" value={totals.clicks.toLocaleString()} />
            <Card label="Cobrado" value={`$${totals.paid.toFixed(0)}`} />
            <Card label="Pendiente" value={`$${totals.pending.toFixed(0)}`} />
          </div>

          <div className="rounded-2xl border bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Cliente</th>
                  <th className="text-right px-3 py-2">Posts</th>
                  <th className="text-right px-3 py-2">Likes</th>
                  <th className="text-right px-3 py-2">Impres.</th>
                  <th className="text-right px-3 py-2">Clicks</th>
                  <th className="text-right px-3 py-2">CTR</th>
                  <th className="text-right px-3 py-2">Inversión</th>
                  <th className="text-right px-3 py-2">Conv.</th>
                  <th className="text-right px-3 py-2">Cobrado</th>
                  <th className="text-right px-3 py-2">Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rctr = r.impressions ? (r.clicks / r.impressions) * 100 : 0;
                  return (
                    <tr key={r.client_id} className="border-t">
                      <td className="px-4 py-2 font-medium">{r.client_name}</td>
                      <td className="text-right px-3 py-2">{r.posts}</td>
                      <td className="text-right px-3 py-2">{r.likes.toLocaleString()}</td>
                      <td className="text-right px-3 py-2">{r.impressions.toLocaleString()}</td>
                      <td className="text-right px-3 py-2">{r.clicks.toLocaleString()}</td>
                      <td className="text-right px-3 py-2">{rctr.toFixed(2)}%</td>
                      <td className="text-right px-3 py-2">${r.spend.toFixed(0)}</td>
                      <td className="text-right px-3 py-2">{r.conversions}</td>
                      <td className="text-right px-3 py-2">${r.paid.toFixed(0)}</td>
                      <td className="text-right px-3 py-2 text-muted-foreground">${r.pending.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
