import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Info, Loader2, Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSetupStatus, runSetupIngest, type SetupIngestResult } from "@/lib/meta/setup.functions";
import { META_SCOPES } from "@/lib/meta/scopes";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { captureInstagramGridVersion } from "@/lib/meta/igSync.functions";
import { monthLabel } from "@/lib/instagram/gridVersions";
import { chileDate } from "@/lib/dates/chile";
import { HIDDEN_SECTIONS } from "@/lib/clientSections";
import { supabase } from "@/integrations/supabase/client";
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
  StatusBadge,
  type StatusTone,
} from "@/components/app";

/** Planes que incluyen Meta Ads (cuenta publicitaria e ingesta de anuncios). */
const PLANS_WITH_ADS: readonly string[] = ["crecimiento"];

export const Route = createFileRoute("/_app/clients/$clientId/setup")({
  head: () => ({
    meta: [
      { title: "Configurar | Vibranding" },
      { name: "description", content: "Pasos ordenados para activar cada sección del cliente." },
      { property: "og:title", content: "Configurar | Vibranding" },
      {
        property: "og:description",
        content: "Pasos ordenados para activar cada sección del cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

type StepState = "done" | "available" | "blocked";

const STEP_LABEL: Record<StepState, { label: string; tone: StatusTone }> = {
  done: { label: "Listo", tone: "success" },
  available: { label: "Pendiente", tone: "info" },
  blocked: { label: "Bloqueado", tone: "neutral" },
};

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

const iso = (d: Date) => chileDate(d);

/** Instructions stay reachable behind a disclosure once a step is done. */
function HowTo({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-app-md border border-border-subtle bg-surface-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-app-md px-3 py-2 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ¿Cómo se hace?
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="space-y-3 px-3 pb-3 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Technical permission names stay out of the way, one click behind an info icon. */
function ScopesInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ver permisos requeridos"
          className="text-muted-foreground transition hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 text-xs">
        <p className="font-medium text-foreground">Permisos requeridos en Meta</p>
        <div className="flex flex-wrap gap-1">
          {META_SCOPES.map((s) => (
            <code key={s} className="rounded bg-muted px-1.5 py-0.5">
              {s}
            </code>
          ))}
        </div>
        <p className="text-muted-foreground">
          Solo lectura de métricas de anuncios, página e Instagram. Nada se publica sin tu
          confirmación.
        </p>
      </PopoverContent>
    </Popover>
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
  const { caps, reload, loading: capsLoading, error: capsError } = useClientCapabilities(clientId);
  const fetchStatus = useServerFn(getSetupStatus);
  const runIngest = useServerFn(runSetupIngest);

  const {
    data: status,
    refetch,
    isLoading: statusLoading,
    error: statusError,
    isFetching: statusFetching,
  } = useQuery({
    queryKey: ["setup-status", clientId],
    queryFn: () => fetchStatus({ data: { clientId } }),
  });
  const plan = useQuery({
    queryKey: ["client-plan", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_billing")
        .select("plan_key")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.plan_key ?? null;
    },
  });
  const planKey = plan.data ?? null;
  // Sin plan conocido mostramos todo; con plan sin Meta Ads se ocultan sus pasos.
  const adsIncluded = !planKey || PLANS_WITH_ADS.includes(planKey);
  const account = status?.account ?? null;
  const ig = status?.instagram ?? null;

  // `undefined` = automático: abre el primer paso pendiente. `null` = todos cerrados.
  const [open, setOpen] = useState<number | null | undefined>(undefined);
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<SetupIngestResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [to, setTo] = useState(() => iso(new Date(Date.now() - 86400000)));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 7 * 86400000)));

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
        Da acceso de lectura a la cuenta publicitaria y a la cuenta de Instagram del cliente, y pega
        la clave de acceso en la tarjeta de conexión de Meta Ads.
      </p>
      <p className="flex items-center gap-1.5">
        <ScopesInfo />
        <span className="text-xs">Ver los permisos que se solicitan</span>
      </p>
    </>
  );

  const allSteps: {
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
      unlocks: "Necesario para vincular Instagram y la cuenta publicitaria",
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
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>
                Reconfigurar
              </Link>
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
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>
                Abrir conexión de Meta
              </Link>
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
      blockedBy: "Primero conecta Meta",
      body: caps.has_ad_account ? (
        <div className="space-y-3">
          <Facts
            lines={[
              `${account?.ad_account_id} · moneda ${account?.currency ?? "desconocida"} · zona horaria ${account?.timezone_name ?? "desconocida"}`,
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>
                Cambiar
              </Link>
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
            <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>
              Elegir cuenta publicitaria
            </Link>
          </Button>
        </div>
      ),
    },
    {
      n: 3,
      title: "Vincular Instagram",
      unlocks: "Desbloquea Instagram",
      state: caps.has_instagram ? "done" : caps.meta_connected ? "available" : "blocked",
      blockedBy: "Primero conecta Meta",
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
              <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>
                Cambiar
              </Link>
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
            <Link to="/clients/$clientId/meta-ads" params={{ clientId }}>
              Vincular Instagram
            </Link>
          </Button>
        </div>
      ),
    },
    {
      n: 4,
      title: "Primera ingesta de anuncios",
      unlocks: "Trae gasto, impresiones y conversaciones de los anuncios",
      // Completion is "ran successfully at least once", not "wrote rows":
      // an account without spend would stay pending forever.
      state: caps.ingest_ran ? "done" : caps.has_ad_account ? "available" : "blocked",
      blockedBy: "Primero asigna la cuenta publicitaria",
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
              {ingesting
                ? "Sincronizando…"
                : caps.ingest_ran
                  ? "Volver a sincronizar"
                  : "Sincronizar ahora"}
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
      blockedBy: "Primero vincula Instagram",
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
      unlocks: "Opcional (servicio Chatbot) · desbloquea WhatsApp",
      state: caps.has_whatsapp ? "done" : "available",
      body: caps.has_whatsapp ? (
        <div className="space-y-3">
          <Facts lines={["Número de la Cloud API conectado · el bot puede recibir y responder"]} />
          <Button asChild size="sm" variant="secondary">
            <Link
              to="/clients/$clientId/bandeja"
              params={{ clientId }}
              search={{ tab: "whatsapp" }}
            >
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
            <Link
              to="/clients/$clientId/bandeja"
              params={{ clientId }}
              search={{ tab: "whatsapp" }}
            >
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
            <Link to="/clients/$clientId/backfill" params={{ clientId }}>
              Seguir marcando
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Marca cada conversación como respondida, calificada, cerrada o perdida.</p>
          <Button asChild size="sm">
            <Link to="/clients/$clientId/backfill" params={{ clientId }}>
              Ir a marcar conversaciones
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  // Pasos ocultos: marcar conversaciones (Analítica está oculta) y Meta Ads si el plan no lo incluye.
  const steps = allSteps.filter((s) => {
    if (s.n === 7) return !HIDDEN_SECTIONS.has("analytics");
    if (s.n === 2 || s.n === 4) return adsIncluded;
    return true;
  });

  const loadError = statusError ?? capsError ?? plan.error;
  if (loadError) {
    return (
      <div className="max-w-3xl">
        <ErrorState
          title="No pudimos cargar la configuración del cliente"
          message={loadError.message}
          onRetry={() => void Promise.all([refetch(), reload(), plan.refetch()])}
          retrying={statusFetching}
        />
      </div>
    );
  }
  if (statusLoading || capsLoading || plan.isLoading) {
    return (
      <div className="max-w-3xl">
        <ListSkeleton rows={5} label="Cargando configuración" />
      </div>
    );
  }

  const doneCount = steps.filter((s) => s.state === "done").length;
  const openStep =
    open === undefined ? (steps.find((s) => s.state === "available")?.n ?? null) : open;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        size="compact"
        title="Configurar"
        actions={
          <>
            <StatusBadge
              status={doneCount === steps.length ? "setup_done" : "setup_pending"}
              label={`${doneCount} de ${steps.length} listos`}
              tone={doneCount === steps.length ? "success" : "neutral"}
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ScopesInfo />
              Permisos de Meta
            </span>
          </>
        }
      />

      <ol className="space-y-2">
        {steps.map((s, index) => {
          const expanded = openStep === s.n;
          const bodyId = `setup-step-${s.n}`;
          return (
            <li
              key={s.n}
              className={`rounded-app-lg border bg-surface shadow-app-xs ${
                expanded ? "border-border-strong" : "border-border-subtle"
              }`}
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => setOpen(expanded ? null : s.n)}
                className="flex w-full items-center gap-3 rounded-app-lg px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    s.state === "done"
                      ? "bg-primary text-primary-foreground"
                      : s.state === "blocked"
                        ? "bg-surface-2 text-muted-foreground"
                        : "border border-primary text-primary"
                  }`}
                >
                  {s.state === "done" ? (
                    <Check aria-hidden className="h-4 w-4" />
                  ) : s.state === "blocked" ? (
                    <Lock aria-hidden className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.unlocks}</span>
                </span>
                <StatusBadge
                  status={`setup_${s.state}`}
                  label={STEP_LABEL[s.state].label}
                  tone={STEP_LABEL[s.state].tone}
                />
                <ChevronDown
                  aria-hidden
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
              {expanded && (
                <div id={bodyId} className="px-4 pb-4 sm:pl-14">
                  {s.state === "blocked" ? (
                    <p className="text-sm text-muted-foreground">{s.blockedBy}</p>
                  ) : (
                    s.body
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
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
      {lastSyncAt && <Facts lines={[`Última sincronización: ${fmtDate(lastSyncAt)}`]} />}
      <p>
        Trae las publicaciones reales de la cuenta al grid Actual. No modifica tu propuesta ni el
        estado inicial.
      </p>
      <Button
        size="sm"
        variant={lastSyncAt ? "secondary" : "default"}
        onClick={run}
        disabled={busy}
      >
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
