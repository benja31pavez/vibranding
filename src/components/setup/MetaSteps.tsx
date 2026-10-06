import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, ListSkeleton, StatusBadge } from "@/components/app";
import { MetaConnectCard } from "@/components/meta-ads/MetaConnectCard";
import { runSetupIngest, type SetupIngestResult } from "@/lib/meta/setup.functions";
import { captureInstagramGridVersion } from "@/lib/meta/igSync.functions";
import { monthLabel } from "@/lib/instagram/gridVersions";
import { chileDate } from "@/lib/dates/chile";
import { ADS_BILLING_STATE_LABEL, adsBillingRows } from "@/lib/ads-billing/combined";
import { evaluateMetaBilling, metaBillingHubUrl } from "@/lib/ads-billing/metaStatus";
import { ADS_BILLING_TONE } from "@/components/clients/ficha/AdsBillingPanel";
import { Facts, HowTo, ScopesInfo } from "./setupShared";
import { fmtDate } from "./setupConstants";
import type { ConnectionsState } from "./useConnections";

const DAY_MS = 86_400_000;

/** Paso compartido por Instagram y Meta Ads: la sesión de Meta del cliente. */
export function MetaLoginStep({ clientId, state }: { clientId: string; state: ConnectionsState }) {
  const account = state.status.data?.account ?? null;
  const connected = state.caps.meta_connected;
  return (
    <div className="space-y-4">
      <MetaConnectCard clientId={clientId} />
      {connected && account && (
        <Facts
          lines={[
            `${account.auth_type === "org_system_user" ? "Token de System User de la organización" : "Token de System User"} · ${account.scopes?.length ?? 0} permisos concedidos · ${
              account.token_valid === false
                ? "Meta reporta el token como no válido"
                : account.token_expires_at
                  ? `válido, expira ${fmtDate(account.token_expires_at)}`
                  : "válido, sin fecha de expiración"
            } · última validación ${fmtDate(account.last_validated_at)}`,
            ...(account.business_name ? [`Business Manager: ${account.business_name}`] : []),
          ]}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Es la misma sesión para Instagram y Meta Ads: si ya está lista en una, en la otra aparece
        como hecha.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ScopesInfo /> Permisos de Meta
        </span>
        <Link
          to="/admin/meta-diagnostics"
          className="inline-flex items-center gap-1.5 text-primary hover:underline"
        >
          <Stethoscope aria-hidden className="h-3.5 w-3.5" /> Diagnóstico de Meta
        </Link>
      </div>
      <HowTo>
        <p>
          Da acceso de lectura a la cuenta publicitaria y a la cuenta de Instagram del cliente. Si
          «Conectar con Meta» no funciona, usa un token permanente de System User.
        </p>
      </HowTo>
    </div>
  );
}

/** Meta Ads · Primera ingesta de anuncios en un rango de fechas. */
export function IngestStep({ state }: { state: ConnectionsState }) {
  const runIngest = useServerFn(runSetupIngest);
  const account = state.status.data?.account ?? null;
  const ran = state.caps.ingest_ran;
  const [ingesting, setIngesting] = useState(false);
  const [result, setResult] = useState<SetupIngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState(() => chileDate(new Date(Date.now() - DAY_MS)));
  const [from, setFrom] = useState(() => chileDate(new Date(Date.now() - 7 * DAY_MS)));

  const doIngest = async () => {
    if (!account?.id) return;
    setIngesting(true);
    setResult(null);
    setError(null);
    try {
      setResult(await runIngest({ data: { accountId: account.id, from, to } }));
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido de Meta");
    } finally {
      setIngesting(false);
      await state.refreshMeta();
    }
  };

  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      {ran && (
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
          <Label htmlFor="ingest-from" className="text-xs">
            Desde
          </Label>
          <Input
            id="ingest-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ingest-to" className="text-xs">
            Hasta
          </Label>
          <Input
            id="ingest-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <Button
          size="sm"
          onClick={() => void doIngest()}
          disabled={ingesting || !account?.id}
          variant={ran ? "secondary" : "default"}
        >
          {ingesting && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
          {ingesting ? "Sincronizando…" : ran ? "Volver a sincronizar" : "Sincronizar ahora"}
        </Button>
      </div>
      {error && (
        <p className="text-danger-strong" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-2 rounded-app-md border border-border-subtle p-3" role="status">
          <p className="text-foreground">
            {result.ok ? "Ingesta completada" : "La ingesta falló"} · {result.adRows} filas de
            anuncios y {result.postRows} de publicaciones ({result.from} → {result.to})
            {result.ok && result.adRows + result.postRows === 0 && " · sin datos aún"}
          </p>
          {result.causes.map((c) => (
            <p
              key={c.code + c.message}
              className={c.code === "meta_error" ? "text-danger-strong" : ""}
            >
              {c.code === "meta_error" ? `Meta respondió: ${c.message}` : c.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Meta Ads · Medio de pago de la pauta (solo lectura: chequeo diario + lo declarado). */
export function MetaBillingStep({ state }: { state: ConnectionsState }) {
  const { adsBilling } = state;
  if (adsBilling.isLoading) return <ListSkeleton rows={2} label="Revisando pago de pauta" />;
  if (adsBilling.error || !adsBilling.data) {
    return (
      <ErrorState
        title="No pudimos leer el pago de pauta"
        message={(adsBilling.error as Error | null)?.message}
        onRetry={() => void adsBilling.refetch()}
        retrying={adsBilling.isFetching}
      />
    );
  }
  const row = adsBillingRows(adsBilling.data).find((r) => r.platform === "meta");
  if (!row) return null;
  const metaStatus = adsBilling.data.metaStatus;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          status={`meta-billing-${row.state}`}
          label={ADS_BILLING_STATE_LABEL[row.state]}
          tone={ADS_BILLING_TONE[row.state]}
        />
        <span className="text-muted-foreground">
          {metaStatus ? evaluateMetaBilling(metaStatus).label : row.hint}
        </span>
      </div>
      <p className="text-muted-foreground">
        El cliente paga la pauta con su propia tarjeta en su cuenta publicitaria. El estado se
        revisa solo cada día.
      </p>
      <Button asChild size="sm" variant="outline">
        <a
          href={metaBillingHubUrl(adsBilling.data.metaAdAccountId)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Configuración de pagos en Meta <ExternalLink aria-hidden className="ml-1.5 h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}

/** Instagram · Trae las publicaciones reales al grid Actual. */
export function InstagramSyncStep({
  clientId,
  state,
}: {
  clientId: string;
  state: ConnectionsState;
}) {
  const capture = useServerFn(captureInstagramGridVersion);
  const lastSyncAt = state.status.data?.account?.last_ig_sync_at ?? null;
  const ig = state.status.data?.instagram ?? null;
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
        await state.refreshMeta();
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
    <div className="space-y-4 text-sm text-muted-foreground">
      {lastSyncAt && (
        <Facts
          lines={[
            `Última sincronización: ${fmtDate(lastSyncAt)}${
              ig?.followers != null ? ` · ${ig.followers.toLocaleString("es-CL")} seguidores` : ""
            }`,
          ]}
        />
      )}
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
        {busy && <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {busy ? "Sincronizando…" : lastSyncAt ? "Volver a sincronizar" : "Sincronizar Instagram"}
      </Button>
      {msg && (
        <p className="text-foreground" role="status">
          {msg}
        </p>
      )}
      <HowTo>
        <p>
          Cada sincronización guarda una versión del grid Actual con la fecha de captura. Las
          versiones anteriores quedan como registro histórico y no se editan.
        </p>
      </HowTo>
    </div>
  );
}
