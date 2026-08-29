import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { Button } from "@/components/ui/button";
import { LogOut, Target, CheckSquare } from "lucide-react";

export const Route = createFileRoute("/portal")({
  ssr: false,
  component: ClientPortal,
  head: () => ({
    meta: [
      { title: "Portal del cliente | Vibranding" },
      {
        name: "description",
        content:
          "Consulta la analítica, las etapas y los objetivos de tu cuenta gestionada por Vibranding.",
      },
      { property: "og:title", content: "Portal del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Analítica, etapas y objetivos de tu cuenta en modo lectura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

interface Item {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  in_review: "En revisión",
  done: "Listo",
};

function ClientPortal() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [deliverables, setDeliverables] = useState<Item[]>([]);
  const [objectives, setObjectives] = useState<Item[]>([]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: cid } = await supabase.rpc("user_client_id");
      if (!cid) {
        setReady(true);
        return;
      }
      setClientId(cid as string);
      const [{ data: c }, { data: d }, { data: o }] = await Promise.all([
        supabase.from("clients").select("name").eq("id", cid as string).maybeSingle(),
        supabase
          .from("deliverables")
          .select("id,title,status,due_date")
          .eq("client_id", cid as string)
          .order("sort_order"),
        supabase
          .from("objectives")
          .select("id,title,status,due_date")
          .eq("client_id", cid as string)
          .order("sort_order"),
      ]);
      setClientName(c?.name ?? "");
      setDeliverables((d ?? []) as Item[]);
      setObjectives((o ?? []) as Item[]);
      setReady(true);
    })();
  }, [session?.user?.id]);

  if (loading || !session) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-sidebar/95 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-6 h-16">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand bg-gradient-brand-animated">
            Vibranding
          </span>
          <div className="ml-auto flex items-center gap-3">
            {clientName && <span className="text-sm text-muted-foreground">{clientName}</span>}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {!ready ? (
          <div className="text-muted-foreground">Cargando…</div>
        ) : !clientId ? (
          <div className="rounded-2xl border bg-surface p-6 text-sm text-muted-foreground">
            Tu cuenta todavía no tiene un cliente asignado. Contacta con tu equipo de Vibranding.
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Tu cuenta</h1>
            <AnalyticsDashboard clientId={clientId} />

            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ReadOnlyList
                icon={<CheckSquare className="w-4 h-4" />}
                title="Etapas"
                items={deliverables}
              />
              <ReadOnlyList
                icon={<Target className="w-4 h-4" />}
                title="Objetivos"
                items={objectives}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function ReadOnlyList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: Item[];
}) {
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-center gap-2 text-sm font-medium mb-3">
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sin registros por ahora.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{i.title}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {STATUS_LABEL[i.status] ?? i.status}
                {i.due_date ? ` · ${i.due_date}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
