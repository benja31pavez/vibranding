import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ChevronDown, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { syncMetaInsights } from "@/lib/meta/connection.functions";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";

export const Route = createFileRoute("/_app/clients/$clientId/setup")({
  head: () => ({
    meta: [
      { title: "Configurar cliente | Vibranding" },
      { name: "description", content: "Pasos ordenados para activar cada sección del cliente." },
      { property: "og:title", content: "Configurar cliente | Vibranding" },
      { property: "og:description", content: "Pasos ordenados para activar cada sección del cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

type StepState = "done" | "available" | "blocked";

function SetupPage() {
  const { clientId } = Route.useParams();
  const { caps, reload } = useClientCapabilities(clientId);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(1);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const runIngest = useServerFn(syncMetaInsights);

  useEffect(() => {
    (supabase.from("meta_accounts" as any) as any)
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle()
      .then(({ data }: any) => setAccountId(data?.id ?? null));
  }, [clientId]);

  const doIngest = async () => {
    if (!accountId) return;
    setIngesting(true);
    setIngestMsg(null);
    try {
      const res: any = await runIngest({ data: { accountId } });
      if (res?.error) {
        setIngestMsg({ ok: false, text: `Meta respondió: ${res.error}` });
      } else {
        setIngestMsg({
          ok: true,
          text: `${res.adRows} filas de anuncios y ${res.postRows} de publicaciones escritas (${res.from} → ${res.to}).`,
        });
      }
      await reload();
    } catch (e: any) {
      setIngestMsg({ ok: false, text: e?.message ?? "Error desconocido de Meta" });
    } finally {
      setIngesting(false);
    }
  };

  const steps: {
    n: number;
    title: string;
    unlocks: string;
    state: StepState;
    blockedBy?: string;
    body: React.ReactNode;
  }[] = [
    {
      n: 1,
      title: "Conectar Meta",
      unlocks: "No activa secciones por sí solo, pero los pasos 2 y 3 lo necesitan",
      state: caps.meta_connected ? "done" : "available",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            En Business Manager crea un System User con rol de administrador, asígnale la cuenta
            publicitaria y la página/Instagram, genera un token permanente con los permisos
            <code className="mx-1">ads_management</code>,
            <code className="mx-1">business_management</code>,
            <code className="mx-1">instagram_basic</code> y
            <code className="mx-1">pages_show_list</code>, y pégalo en la tarjeta de conexión.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>Abrir conexión de Meta</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/meta-diagnostics">Diagnóstico de Meta</Link>
            </Button>
          </div>
        </div>
      ),
    },
    {
      n: 2,
      title: "Asignar cuenta publicitaria",
      unlocks: "Desbloquea Meta Ads",
      state: caps.has_ad_account ? "done" : caps.meta_connected ? "available" : "blocked",
      blockedBy: "Primero conecta Meta (paso 1)",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Elige la cuenta publicitaria del cliente en el selector de activos de Meta.</p>
          <Button asChild size="sm">
            <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>Elegir cuenta publicitaria</Link>
          </Button>
        </div>
      ),
    },
    {
      n: 3,
      title: "Vincular Instagram",
      unlocks: "Desbloquea Instagram y Automatización",
      state: caps.has_instagram ? "done" : caps.meta_connected ? "available" : "blocked",
      blockedBy: "Primero conecta Meta (paso 1)",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Selecciona la cuenta profesional de Instagram vinculada a la página del cliente.</p>
          <Button asChild size="sm">
            <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>Vincular Instagram</Link>
          </Button>
        </div>
      ),
    },
    {
      n: 4,
      title: "Primera ingesta de anuncios",
      unlocks: "Desbloquea Analítica",
      state: caps.has_ad_data ? "done" : caps.has_ad_account ? "available" : "blocked",
      blockedBy: "Primero asigna la cuenta publicitaria (paso 2)",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Trae los últimos 7 días de gasto, impresiones y conversaciones iniciadas.</p>
          <Button size="sm" onClick={doIngest} disabled={ingesting || !accountId}>
            {ingesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sincronizar ahora
          </Button>
          {ingestMsg && (
            <p className={ingestMsg.ok ? "text-foreground" : "text-destructive"}>{ingestMsg.text}</p>
          )}
        </div>
      ),
    },
    {
      n: 5,
      title: "Sincronizar Instagram",
      unlocks: "Llena el grid con las publicaciones reales",
      state: caps.has_instagram ? "available" : "blocked",
      blockedBy: "Primero vincula Instagram (paso 3)",
      body: (
        <div className="space-y-3 text-sm">
          <div className="flex gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Deshabilitado a propósito: la sincronización actual elimina las publicaciones subidas
              a mano sin reemplazarlas. Se habilitará cuando ese error esté corregido.
            </p>
          </div>
          <Button size="sm" disabled>Sincronizar Instagram</Button>
        </div>
      ),
    },
    {
      n: 6,
      title: "Conectar WhatsApp",
      unlocks: "Desbloquea Bandeja",
      state: caps.has_whatsapp ? "done" : "available",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Conecta el número de la Cloud API para recibir conversaciones y activar el bot.</p>
          <Button asChild size="sm">
            <Link to="/clients/$clientId/bandeja" params={{ clientId }} search={{ tab: "whatsapp" }}>
              Conectar WhatsApp
            </Link>
          </Button>
        </div>
      ),
    },
    {
      n: 7,
      title: "Marcar conversaciones",
      unlocks: "Completa Analítica",
      state: caps.has_outcomes ? "done" : caps.has_whatsapp ? "available" : "blocked",
      blockedBy: "Primero conecta WhatsApp (paso 6)",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Marca cada conversación como respondida, calificada, cerrada o perdida.</p>
          <Button asChild size="sm">
            <Link to="/clients/$clientId/backfill" params={{ clientId }}>Ir a marcar conversaciones</Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurar cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cada paso indica qué secciones del panel desbloquea. El estado se calcula siempre desde la
          base de datos, igual que el panel lateral.
        </p>
      </div>

      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl border bg-card">
            <button
              onClick={() => setOpen(open === s.n ? null : s.n)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
                  s.state === "done"
                    ? "bg-primary text-primary-foreground"
                    : s.state === "blocked"
                      ? "bg-muted text-muted-foreground"
                      : "border border-primary text-primary"
                }`}
              >
                {s.state === "done" ? <Check className="w-4 h-4" /> : s.state === "blocked" ? <Lock className="w-3 h-3" /> : s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium truncate">{s.title}</span>
                <span className="block text-xs text-muted-foreground truncate">{s.unlocks}</span>
              </span>
              <Badge variant={s.state === "done" ? "default" : s.state === "blocked" ? "outline" : "secondary"}>
                {s.state === "done" ? "Listo" : s.state === "blocked" ? "Bloqueado" : "Disponible"}
              </Badge>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open === s.n ? "rotate-180" : ""}`} />
            </button>
            {open === s.n && (
              <div className="px-4 pb-4 pl-14">
                {s.state === "blocked" ? (
                  <p className="text-sm text-muted-foreground">{s.blockedBy}</p>
                ) : (
                  s.body
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
