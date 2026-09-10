import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSetupStatus, runSetupIngest, type SetupIngestResult } from "@/lib/meta/setup.functions";
import { META_SCOPES } from "@/lib/meta/scopes";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { captureInstagramGridVersion } from "@/lib/meta/igSync.functions";
import { monthLabel } from "@/lib/instagram/gridVersions";

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

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "sin registro";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Instructions stay reachable behind a disclosure once a step is done. */
function HowTo({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium"
      >
        ¿Cómo se hace?
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-3 px-3 pb-3 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

function Facts({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((l) => (
        <li key={l} className="flex gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{l}</span>
        </li>
      ))}
    </ul>
  );
}

function SetupPage() {
  const { clientId } = Route.useParams();
  const { caps, reload } = useClientCapabilities(clientId);
  const fetchStatus = useServerFn(getSetupStatus);
  const runIngest = useServerFn(runSetupIngest);

  const { data: status, refetch } = useQuery({
    queryKey: ["setup-status", clientId],
    queryFn: () => fetchStatus({ data: { clientId } }),
  });
  const account = status?.account ?? null;
  const ig = status?.instagram ?? null;

  const [open, setOpen] = useState<number | null>(1);
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<SetupIngestResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [to, setTo] = useState(() => iso(new Date(Date.now() - 86400000)));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 7 * 86400000)));

  const scopeList = META_SCOPES.join(", ");

  const doIngest = async () => {
    if (!account?.id) return;
    setIngesting(true);
    setResult(null);
    setIngestError(null);
    try {
      setResult(await runIngest({ data: { accountId: account.id, from, to } }));
    } catch (e: any) {
      setIngestError(e?.message ?? "Error desconocido de Meta");
    } finally {
      setIngesting(false);
      await Promise.all([reload(), refetch()]);
    }
  };

  const metaInstructions = (
    <>
      <p>
        Da acceso de lectura a la cuenta publicitaria y a la cuenta de Instagram del cliente, y
        pega la clave de acceso en la tarjeta de conexión de Meta Ads.
      </p>
      <p className="flex items-center gap-1.5">
        <ScopesInfo />
        <span className="text-xs">Ver los permisos que se solicitan</span>
      </p>
    </>
  );

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
      body: caps.meta_connected ? (
        <div className="space-y-3">
          <Facts
            lines={[
              `${account?.auth_type === "org_system_user" ? "Token de System User de la organización" : "Token de System User"} conectado · ${account?.scopes?.length ?? 0} permisos concedidos · ${
                account?.token_valid === false
                  ? "Meta reporta el token como no válido"
                  : account?.token_expires_at
                    ? `válido, expira ${fmtDate(account.token_expires_at)}`
                    : "válido, sin fecha de expiración"
              } · última validación ${fmtDate(account?.last_validated_at)}`,
              ...(account?.business_name ? [`Business Manager: ${account.business_name}`] : []),
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>Reconfigurar</Link>
            </Button>
            <Button asChild size="sm" variant="link" className="px-0">
              <Link to="/admin/meta-diagnostics">Ver diagnóstico</Link>
            </Button>
          </div>
          <HowTo>{metaInstructions}</HowTo>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-muted-foreground">
          {metaInstructions}
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
      body: caps.has_ad_account ? (
        <div className="space-y-3">
          <Facts
            lines={[
              `${account?.ad_account_id} · moneda ${account?.currency ?? "desconocida"} · zona horaria ${account?.timezone_name ?? "desconocida"}`,
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>Cambiar</Link>
            </Button>
            <Button asChild size="sm" variant="link" className="px-0">
              <Link to="/admin/meta-diagnostics">Ver diagnóstico</Link>
            </Button>
          </div>
          <HowTo>
            <p>Elige la cuenta publicitaria del cliente en el selector de activos de Meta.</p>
          </HowTo>
        </div>
      ) : (
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
      body: caps.has_instagram ? (
        <div className="space-y-3">
          <Facts
            lines={[
              `${ig?.username ? `@${ig.username}` : `ID ${account?.ig_account_id}`} · ${
                ig?.followers != null
                  ? `${ig.followers.toLocaleString("es-CL")} seguidores`
                  : "seguidores sin sincronizar"
              } · sincronizado ${fmtDate(ig?.syncedAt)}`,
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>Cambiar</Link>
            </Button>
            <Button asChild size="sm" variant="link" className="px-0">
              <Link to="/admin/meta-diagnostics">Ver diagnóstico</Link>
            </Button>
          </div>
          <HowTo>
            <p>Selecciona la cuenta profesional de Instagram vinculada a la página del cliente.</p>
          </HowTo>
        </div>
      ) : (
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
      // Completion is "ran successfully at least once", not "wrote rows":
      // an account without spend would stay pending forever.
      state: caps.ingest_ran ? "done" : caps.has_ad_account ? "available" : "blocked",
      blockedBy: "Primero asigna la cuenta publicitaria (paso 2)",
      body: (
        <div className="space-y-3 text-sm text-muted-foreground">
          {caps.ingest_ran && (
            <Facts
              lines={[
                `Última ingesta ${fmtDate(account?.last_ingest_at)} · ${account?.last_ingest_rows ?? 0} filas escritas${
                  (account?.last_ingest_rows ?? 0) === 0 ? " · sin datos aún" : ""
                }`,
              ]}
            />
          )}
          <p>Elige el rango de fechas que quieres traer (gasto, impresiones y conversaciones).</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 w-[9.5rem]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 w-[9.5rem]"
              />
            </div>
            <Button
              size="sm"
              onClick={doIngest}
              disabled={ingesting || !account?.id}
              variant={caps.ingest_ran ? "secondary" : "default"}
            >
              {ingesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {ingesting ? "Sincronizando…" : caps.ingest_ran ? "Volver a sincronizar" : "Sincronizar ahora"}
            </Button>
          </div>

          {ingestError && <p className="text-destructive">{ingestError}</p>}

          {result && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-foreground">
                {result.ok ? "Ingesta completada" : "La ingesta falló"} · {result.adRows} filas de
                anuncios y {result.postRows} de publicaciones ({result.from} → {result.to})
                {result.ok && result.adRows + result.postRows === 0 && " · sin datos aún"}
              </p>
              {result.causes.map((c) => (
                <p
                  key={c.code + c.message}
                  className={c.code === "meta_error" ? "text-destructive" : ""}
                >
                  {c.code === "meta_error" ? `Meta respondió: ${c.message}` : c.message}
                </p>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      n: 5,
      title: "Sincronizar Instagram",
      unlocks: "Llena el grid Actual con las publicaciones reales",
      state: account?.last_ig_sync_at ? "done" : caps.has_instagram ? "available" : "blocked",
      blockedBy: "Primero vincula Instagram (paso 3)",
      body: (
        <InstagramSyncStep
          clientId={clientId}
          lastSyncAt={account?.last_ig_sync_at ?? null}
          onDone={async () => {
            await Promise.all([reload(), refetch()]);
          }}
        />
      ),
    },

    {
      n: 6,
      title: "Conectar WhatsApp",
      unlocks: "Desbloquea Bandeja",
      state: caps.has_whatsapp ? "done" : "available",
      body: caps.has_whatsapp ? (
        <div className="space-y-3">
          <Facts lines={["Número de la Cloud API conectado · el bot puede recibir y responder"]} />
          <Button asChild size="sm" variant="secondary">
            <Link to="/clients/$clientId/bandeja" params={{ clientId }} search={{ tab: "whatsapp" }}>
              Reconfigurar
            </Link>
          </Button>
          <HowTo>
            <p>Conecta el número de la Cloud API para recibir conversaciones y activar el bot.</p>
          </HowTo>
        </div>
      ) : (
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
      body: caps.has_outcomes ? (
        <div className="space-y-3">
          <Facts lines={["Ya hay conversaciones marcadas: Analítica puede calcular el embudo"]} />
          <Button asChild size="sm" variant="secondary">
            <Link to="/clients/$clientId/backfill" params={{ clientId }}>Seguir marcando</Link>
          </Button>
        </div>
      ) : (
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
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configurar cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada paso indica qué secciones del panel desbloquea. El estado se calcula siempre desde la
          base de datos, igual que el panel lateral.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Permisos requeridos: {scopeList}</p>
      </div>

      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl border bg-card">
            <button
              onClick={() => setOpen(open === s.n ? null : s.n)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  s.state === "done"
                    ? "bg-primary text-primary-foreground"
                    : s.state === "blocked"
                      ? "bg-muted text-muted-foreground"
                      : "border border-primary text-primary"
                }`}
              >
                {s.state === "done" ? <Check className="h-4 w-4" /> : s.state === "blocked" ? <Lock className="h-3 w-3" /> : s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.unlocks}</span>
              </span>
              <Badge variant={s.state === "done" ? "default" : s.state === "blocked" ? "outline" : "secondary"}>
                {s.state === "done" ? "Listo" : s.state === "blocked" ? "Bloqueado" : "Disponible"}
              </Badge>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === s.n ? "rotate-180" : ""}`} />
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

/** Step 5: pulls the real published grid into the "Actual" track. */
function InstagramSyncStep({
  clientId,
  lastSyncAt,
  onDone,
}: {
  clientId: string;
  lastSyncAt: string | null;
  onDone: () => Promise<void> | void;
}) {
  const capture = useServerFn(captureInstagramGridVersion);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await capture({ data: { clientId, label: monthLabel() } });
      if (res.ok) {
        setMsg(
          res.mediaCount === 0
            ? "Sincronizado · la cuenta no tiene publicaciones"
            : `Versión "${res.label}" creada con ${res.mediaCount} publicaciones reales.` +
              (res.note ? ` ${res.note}` : ""),
        );
        await onDone();
      } else {
        setMsg(res.reason);
      }
    } catch (e: any) {
      setMsg(e?.message ?? "No se pudo sincronizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      {lastSyncAt && (
        <Facts lines={[`Última sincronización: ${fmtDate(lastSyncAt)}`]} />
      )}
      <p>
        Trae las publicaciones reales de la cuenta al grid Actual. No modifica tu propuesta ni el
        estado inicial.
      </p>
      <Button size="sm" variant={lastSyncAt ? "secondary" : "default"} onClick={run} disabled={busy}>
        {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {busy ? "Sincronizando…" : lastSyncAt ? "Volver a sincronizar" : "Sincronizar Instagram"}
      </Button>
      {msg && <p className="text-foreground">{msg}</p>}
      <HowTo>
        <p>
          Cada sincronización guarda una versión del grid Actual con la fecha de captura. Las
          versiones anteriores quedan como registro histórico y no se editan.
        </p>
      </HowTo>
    </div>
  );
}
