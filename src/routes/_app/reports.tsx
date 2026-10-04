import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LatestReportsTable } from "@/components/reports/LatestReportsTable";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reportes por cliente · Vibranding" },
      {
        name: "description",
        content:
          "Métricas agregadas por cliente: publicaciones, inversión publicitaria, clicks, conversaciones y cobros, siempre separados por moneda.",
      },
      { property: "og:title", content: "Reportes por cliente · Vibranding" },
      {
        property: "og:description",
        content: "Resumen de resultados por cliente con montos agrupados por su moneda real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Money = Record<string, number>;

interface Row {
  client_id: string;
  client_name: string;
  posts: number;
  likes: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: Money;
  paid: Money;
  pending: Money;
}

const UNKNOWN = "—";

function addMoney(target: Money, currency: string | null | undefined, amount: number) {
  const key = (currency ?? "").trim().toUpperCase() || UNKNOWN;
  target[key] = (target[key] ?? 0) + amount;
}

function mergeMoney(target: Money, source: Money) {
  for (const [k, v] of Object.entries(source)) target[k] = (target[k] ?? 0) + v;
}

function fmtMoney(currency: string, amount: number): string {
  if (currency === UNKNOWN) return amount.toLocaleString("es-CL", { maximumFractionDigits: 0 });
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

function MoneyList({ money }: { money: Money }) {
  const entries = Object.entries(money).filter(([, v]) => v !== 0);
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      {entries.map(([c, v]) => (
        <span key={c} className="whitespace-nowrap">
          {fmtMoney(c, v)}
        </span>
      ))}
    </span>
  );
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
        // insights are written at ad level only, so aggregate every row we have.
        supabase
          .from("ad_insights_daily")
          .select(
            "client_id,spend,impressions,clicks,messaging_conversations_started,currency",
          )
          .in("client_id", ids),
        supabase.from("payments").select("client_id,amount,status,currency").in("client_id", ids),
      ]);

      const result: Row[] = list.map((c) => {
        const p = (posts ?? []).filter((x: any) => x.client_id === c.id);
        const i = (ins ?? []).filter((x: any) => x.client_id === c.id);
        const pay = (pays ?? []).filter((x: any) => x.client_id === c.id);

        const spend: Money = {};
        for (const x of i as any[]) addMoney(spend, x.currency, Number(x.spend || 0));

        const paid: Money = {};
        const pending: Money = {};
        for (const x of pay as any[]) {
          const amount = Number(x.amount || 0);
          if (x.status === "paid") addMoney(paid, x.currency, amount);
          else if (x.status !== "cancelled") addMoney(pending, x.currency, amount);
        }

        return {
          client_id: c.id,
          client_name: c.name,
          posts: p.length,
          likes: p.reduce((s: number, x: any) => s + Number(x.likes_count || 0), 0),
          impressions: i.reduce((s: number, x: any) => s + Number(x.impressions || 0), 0),
          clicks: i.reduce((s: number, x: any) => s + Number(x.clicks || 0), 0),
          conversions: i.reduce(
            (s: number, x: any) => s + Number(x.messaging_conversations_started || 0),
            0,
          ),
          spend,
          paid,
          pending,
        };
      });
      setRows(result);
    })();
  }, [user]);

  const totals = (rows ?? []).reduce(
    (acc, r) => {
      mergeMoney(acc.spend, r.spend);
      mergeMoney(acc.paid, r.paid);
      mergeMoney(acc.pending, r.pending);
      return {
        ...acc,
        posts: acc.posts + r.posts,
        likes: acc.likes + r.likes,
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        conversions: acc.conversions + r.conversions,
      };
    },
    {
      posts: 0,
      likes: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: {} as Money,
      paid: {} as Money,
      pending: {} as Money,
    },
  );
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;

  const Card = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 flex flex-col">{value}</div>
    </div>
  );

  const MoneyCardValue = ({ money }: { money: Money }) => {
    const entries = Object.entries(money).filter(([, v]) => v !== 0);
    if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <>
        {entries.map(([c, v]) => (
          <span key={c} className="text-2xl font-semibold leading-tight">
            {fmtMoney(c, v)}
          </span>
        ))}
      </>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          <span className="font-brand text-gradient-brand bg-gradient-brand-animated">Reportes</span>
        </h1>
        <p className="text-muted-foreground">
          Métricas agregadas por cliente. Los montos se agrupan por moneda y nunca se suman entre
          monedas distintas.
        </p>
      </header>

      <LatestReportsTable />

      {!rows ? (
        <div className="text-muted-foreground text-sm">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground text-sm">Aún no hay clientes.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Publicaciones" value={String(totals.posts)} />
            <Card label="Likes IG" value={totals.likes.toLocaleString()} />
            <Card label="Inversión Ads" value={<MoneyCardValue money={totals.spend} />} />
            <Card label="CTR" value={`${ctr.toFixed(2)}%`} />
            <Card label="Impresiones" value={totals.impressions.toLocaleString()} />
            <Card label="Clicks" value={totals.clicks.toLocaleString()} />
            <Card label="Cobrado" value={<MoneyCardValue money={totals.paid} />} />
            <Card label="Pendiente" value={<MoneyCardValue money={totals.pending} />} />
          </div>

          <div className="rounded-2xl border bg-surface overflow-x-auto">
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
                      <td className="text-right px-3 py-2">
                        <MoneyList money={r.spend} />
                      </td>
                      <td className="text-right px-3 py-2">{r.conversions}</td>
                      <td className="text-right px-3 py-2">
                        <MoneyList money={r.paid} />
                      </td>
                      <td className="text-right px-3 py-2 text-muted-foreground">
                        <MoneyList money={r.pending} />
                      </td>
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
