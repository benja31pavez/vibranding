import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, CheckCircle2, AlertTriangle, Instagram as IGIcon, ArrowRight, Calendar, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { useAuth } from "@/hooks/use-auth";
import { PricingSummary, ProposedCostsBreakdown, loadPricing, type PricingSettings } from "@/components/PricingPanel";

export const Route = createFileRoute("/_app/clients/$clientId/")({
  component: SummaryPage,
});

type Status = "pending" | "in_progress" | "done";

function SummaryPage() {
  const { clientId } = Route.useParams();
  const { client, ig } = useActiveClient();
  const { user } = useAuth();
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [data, setData] = useState<{
    obj: { status: Status; due_date: string | null; title: string }[];
    del: { status: Status; due_date: string | null; title: string }[];
    pay: { amount: number; status: string; due_date: string | null }[];
  }>({ obj: [], del: [], pay: [] });

  useEffect(() => { if (user) loadPricing(user.id).then(setPricing); }, [user]);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: d }, { data: p }] = await Promise.all([
        supabase.from("objectives").select("status,due_date,title").eq("client_id", clientId),
        supabase.from("deliverables").select("status,due_date,title").eq("client_id", clientId),
        supabase.from("payments").select("amount,status,due_date").eq("client_id", clientId),
      ]);
      setData({ obj: (o ?? []) as any, del: (d ?? []) as any, pay: (p ?? []) as any });
    })();
  }, [clientId]);

  const today = new Date().toISOString().slice(0, 10);
  const objDone = data.obj.filter((x) => x.status === "done").length;
  const delDone = data.del.filter((x) => x.status === "done").length;
  const paid = data.pay.filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.amount), 0);
  const pending = data.pay.filter((x) => x.status !== "paid" && x.status !== "cancelled").reduce((s, x) => s + Number(x.amount), 0);
  const proposed = paid + pending;
  const overdueObj = data.obj.filter((x) => x.status !== "done" && x.due_date && x.due_date < today).length;
  const overdueDel = data.del.filter((x) => x.status !== "done" && x.due_date && x.due_date < today).length;
  const overduePay = data.pay.filter((x) => x.status !== "paid" && x.status !== "cancelled" && x.due_date && x.due_date < today).length;

  const upcomingDel = [...data.del]
    .filter((x) => x.status !== "done" && x.due_date && x.due_date >= today)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 3);

  const upcomingPosts = [...ig.posts]
    .filter((p) => p.scheduled_at && new Date(p.scheduled_at) >= new Date())
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 3);

  const feedPreview = [...ig.posts].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).slice(0, 6);

  const Health = ({ ok, label, hint }: { ok: boolean; label: string; hint: string }) => (
    <div className="flex items-center gap-3 rounded-2xl border bg-surface p-4">
      <div className={`w-10 h-10 rounded-full grid place-items-center ${ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
        {ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );

  const igProfile = ig.profile;
  const followers = igProfile?.current_followers ?? 0;
  const postsCount = igProfile?.current_posts_count ?? 0;
  const totalLikes = ig.posts.reduce((s, p) => s + (p.likes_count ?? 0), 0);
  const engagement = followers > 0 && ig.posts.length > 0
    ? ((totalLikes / ig.posts.length / followers) * 100).toFixed(2) + "%"
    : "—";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border bg-gradient-to-br from-primary/5 to-transparent p-6 flex flex-wrap items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-secondary grid place-items-center overflow-hidden text-2xl font-semibold">
          {igProfile?.current_avatar_url ? (
            <img src={igProfile.current_avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            client?.name?.[0]?.toUpperCase() ?? "?"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Cliente</div>
          <div className="text-2xl font-semibold truncate">{client?.name}</div>
          {client?.instagram_handle && (
            <a href={`https://instagram.com/${client.instagram_handle}`} target="_blank" rel="noreferrer"
              className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
              <IGIcon className="w-3.5 h-3.5" /> @{client.instagram_handle}
            </a>
          )}
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="Seguidores" value={followers.toLocaleString()} />
          <Stat label="Posts" value={String(postsCount)} />
          <Stat label="Engagement" value={engagement} />
        </div>
      </div>

      {/* Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Health ok={overdueObj === 0} label="Objetivos en plazo" hint={overdueObj === 0 ? "Todo al día" : `${overdueObj} vencidos`} />
        <Health ok={overdueDel === 0} label="Etapas al día" hint={overdueDel === 0 ? "Todo al día" : `${overdueDel} vencidos`} />
        <Health ok={overduePay === 0} label="Pagos al día" hint={overduePay === 0 ? "Sin atrasos" : `${overduePay} vencidos`} />
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card label="Objetivos" value={`${objDone}/${data.obj.length}`} hint="completados" />
        <Card label="Etapas" value={`${delDone}/${data.del.length}`} hint="completados" />
        <Card label="Cobrado" value={`$${paid.toFixed(0)}`} hint={`Pendiente $${pending.toFixed(0)}`} />
      </div>

      {/* Financial bar */}
      {proposed > 0 && (
        <div className="rounded-2xl border bg-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Avance financiero</div>
            <div className="text-xs text-muted-foreground">${proposed.toFixed(0)} propuesto</div>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
            <div className="bg-success" style={{ width: `${(paid / proposed) * 100}%` }} />
            <div className="bg-warning" style={{ width: `${(pending / proposed) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" /> Cobrado ${paid.toFixed(0)}</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" /> Pendiente ${pending.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Activity className="w-4 h-4" /> Próximas etapas
          </div>
          {upcomingDel.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay etapas próximas.</div>
          ) : (
            <ul className="space-y-2">
              {upcomingDel.map((d, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d.title}</span>
                  <span className="text-xs text-muted-foreground">{d.due_date}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/clients/$clientId/deliverables" params={{ clientId }} className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="rounded-2xl border bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <Calendar className="w-4 h-4" /> Próximas publicaciones
          </div>
          {upcomingPosts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay publicaciones programadas.</div>
          ) : (
            <ul className="space-y-2">
              {upcomingPosts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm gap-2">
                  <span className="truncate">{p.caption?.slice(0, 60) || "Publicación sin caption"}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(p.scheduled_at!).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Mini feed */}
      {feedPreview.length > 0 && (
        <div className="rounded-2xl border bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IGIcon className="w-4 h-4" /> Feed propuesto
            </div>
            <Link to="/clients/$clientId/instagram" params={{ clientId }} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Ver Instagram <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            {feedPreview.map((p) => (
              <div key={p.id} className="aspect-square rounded-md bg-secondary overflow-hidden">
                {(p.image_url || p.cover_url || p.carousel_urls?.[0]) ? (
                  <img src={(p.image_url || p.cover_url || p.carousel_urls?.[0])!} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <ProposedCostsBreakdown pricing={pricing} posts={ig.posts} />
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
