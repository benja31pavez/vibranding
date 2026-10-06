import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RefreshCw, Plug, Lock, KeyRound } from "lucide-react";
import {
  listClientConnections,
  discoverOrgAssets,
  assignClientAssets,
  validateClientMeta,
  syncClientNow,
  type ClientConnectRow,
} from "@/lib/meta/bulkConnect.functions";
import { getOrgMetaTokenStatus, type OrgTokenStatus } from "@/lib/meta/connection.functions";
import { EmptyState, ErrorState, ListSkeleton, PageContainer, PageHeader } from "@/components/app";

export const Route = createFileRoute("/_app/clients/connect")({
  head: () => ({
    meta: [
      { title: "Conectar clientes con Meta | Vibranding" },
      {
        name: "description",
        content:
          "Asigna cuentas publicitarias e Instagram a varios clientes en una sola pasada usando el token de la organización.",
      },
      { property: "og:title", content: "Conectar clientes con Meta" },
      {
        property: "og:description",
        content: "Asignación masiva de activos de Meta con validación inmediata por cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BulkConnectPage,
});

type Validation = {
  ok: boolean;
  reason?: string;
  token?: { ok: boolean; detail: string; error?: string };
  adAccount?: { ok: boolean; detail: string; error?: string };
  instagram?: { ok: boolean; detail: string; error?: string };
};

type Assets = {
  adAccounts: { id: string; name: string; source: string }[];
  igAccounts: { id: string; username: string; page_id: string | null; source: string }[];
  pages: { id: string; name: string }[];
  scopes: string[];
  warnings: string[];
};

const NONE = "__none__";

function CheckLine({
  label,
  res,
}: {
  label: string;
  res?: { ok: boolean; detail: string; error?: string };
}) {
  if (!res) return null;
  return (
    <div className="flex gap-2 items-start text-xs">
      {res.ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
      )}
      <span>
        <strong>{label}:</strong>{" "}
        {res.error ? <span className="font-mono">{res.error}</span> : res.detail}
      </span>
    </div>
  );
}

function BulkConnectPage() {
  const [rows, setRows] = useState<ClientConnectRow[]>([]);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [orgStatus, setOrgStatus] = useState<OrgTokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { ad: string; ig: string }>>({});
  const [validations, setValidations] = useState<Record<string, Validation>>({});
  const [syncs, setSyncs] = useState<Record<string, any>>({});

  const fetchRows = useServerFn(listClientConnections);
  const fetchAssets = useServerFn(discoverOrgAssets);
  const fetchOrg = useServerFn(getOrgMetaTokenStatus);
  const assign = useServerFn(assignClientAssets);
  const validate = useServerFn(validateClientMeta);
  const sync = useServerFn(syncClientNow);

  const load = async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([
        fetchRows({} as any) as Promise<ClientConnectRow[]>,
        fetchOrg({} as any) as Promise<OrgTokenStatus>,
      ]);
      setRows(r);
      setOrgStatus(o);
      setLoadError(null);
      setDraft(
        Object.fromEntries(
          r.map((c) => [c.clientId, { ad: c.adAccountId ?? NONE, ig: c.igAccountId ?? NONE }]),
        ),
      );
      if (o?.has_token) {
        try {
          setAssets((await fetchAssets({} as any)) as Assets);
        } catch (e: any) {
          toast.error(e?.message ?? "No se pudieron descubrir los activos");
        }
      }
    } catch (e: any) {
      setLoadError(e?.message ?? "No se pudo cargar la lista");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** asset id → client name that already owns it. */
  const taken = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.adAccountId) {
        map.set(r.adAccountId, r.name);
        map.set(r.adAccountId.replace(/^act_/, ""), r.name);
      }
      if (r.igAccountId) map.set(r.igAccountId, r.name);
    }
    return map;
  }, [rows]);

  const takenByOther = (assetId: string, clientId: string) => {
    const owner = taken.get(assetId);
    const self = rows.find((r) => r.clientId === clientId)?.name;
    return owner && owner !== self ? owner : null;
  };

  const doAssign = async (row: ClientConnectRow) => {
    const d = draft[row.clientId];
    if (!d || (d.ad === NONE && d.ig === NONE)) {
      toast.error("Selecciona una cuenta publicitaria o de Instagram");
      return;
    }
    setBusy(row.clientId);
    try {
      const pageId = assets?.igAccounts.find((i) => i.id === d.ig)?.page_id ?? row.pageId ?? null;
      const res = (await assign({
        data: {
          clientId: row.clientId,
          adAccountId: d.ad === NONE ? null : d.ad,
          igAccountId: d.ig === NONE ? null : d.ig,
          pageId,
        },
      })) as { validation: Validation };
      setValidations((v) => ({ ...v, [row.clientId]: res.validation }));
      if (res.validation.ok) toast.success(`${row.name}: validación correcta`);
      else toast.error(`${row.name}: la validación falló`);
      const fresh = (await fetchRows({} as any)) as ClientConnectRow[];
      setRows(fresh);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo asignar");
    } finally {
      setBusy(null);
    }
  };

  const doValidate = async (row: ClientConnectRow) => {
    setBusy(row.clientId);
    try {
      const res = (await validate({ data: { clientId: row.clientId } })) as {
        validation: Validation;
      };
      setValidations((v) => ({ ...v, [row.clientId]: res.validation }));
      setRows((await fetchRows({} as any)) as ClientConnectRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo validar");
    } finally {
      setBusy(null);
    }
  };

  const doSync = async (row: ClientConnectRow) => {
    setBusy(row.clientId);
    try {
      const res = (await sync({ data: { clientId: row.clientId } })) as any;
      setSyncs((s) => ({ ...s, [row.clientId]: res }));
      if (res?.ok === false) toast.error(res.reason);
      else
        toast.success(
          `${row.name}: ${res.adRows} filas de anuncios, ${res.postRows} de publicaciones${
            res.igMedia !== null ? `, ${res.igMedia} medios de Instagram` : ""
          }`,
        );
      setRows((await fetchRows({} as any)) as ClientConnectRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo sincronizar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageContainer className="max-w-5xl space-y-4">
      <PageHeader
        title="Conectar con Meta"
        breadcrumb={[{ label: "Clientes", to: "/clients" }, { label: "Conectar con Meta" }]}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/settings/meta">
                <KeyRound aria-hidden className="mr-1 h-3.5 w-3.5" /> Token de la organización
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw
                aria-hidden
                className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Recargar
            </Button>
          </>
        }
      />

      <p className="text-sm text-muted-foreground">
        Asigna a cada cliente su cuenta publicitaria e Instagram. El token se administra en{" "}
        <Link to="/settings/meta" className="underline underline-offset-2 hover:text-foreground">
          Ajustes › Meta
        </Link>
        .
      </p>

      {loadError && (
        <ErrorState message={loadError} onRetry={() => void load()} retrying={loading} />
      )}
      {loading && !orgStatus && !loadError && (
        <ListSkeleton rows={3} label="Cargando clientes y activos de Meta" />
      )}

      {!loading && !loadError && orgStatus && !orgStatus.has_token && (
        <Card>
          <CardContent className="p-4 text-sm">
            Todavía no hay un token de System User en la organización.{" "}
            <Link to="/settings/meta" className="underline">
              Pégalo una vez
            </Link>{" "}
            y podrás asignar activos a todos los clientes desde aquí.
          </CardContent>
        </Card>
      )}

      {assets?.warnings?.length ? (
        <p className="text-xs text-muted-foreground">
          Avisos de Meta: {assets.warnings.join(" · ")}
        </p>
      ) : null}

      {rows.map((row) => {
        const d = draft[row.clientId] ?? { ad: NONE, ig: NONE };
        const v = validations[row.clientId];
        const s = syncs[row.clientId];
        return (
          <Card key={row.clientId}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                {row.name}
                {row.connected ? (
                  <Badge className="gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Sin validar</Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => doValidate(row)}
                  disabled={busy === row.clientId || !row.accountId}
                >
                  Validar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => doSync(row)}
                  disabled={busy === row.clientId || !row.connected}
                >
                  <RefreshCw
                    className={`w-3 h-3 mr-1 ${busy === row.clientId ? "animate-spin" : ""}`}
                  />
                  Sincronizar ahora
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link
                    to="/clients/$clientId/setup"
                    params={{ clientId: row.clientId }}
                    search={{ conexion: "meta-ads" }}
                  >
                    Abrir
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {row.missing.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {row.missing.map((m) => (
                    <Badge key={m} variant="outline" className="text-[11px]">
                      Falta: {m}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Todo configurado.</p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cuenta publicitaria</p>
                  <Select
                    value={d.ad}
                    onValueChange={(val) =>
                      setDraft((p) => ({ ...p, [row.clientId]: { ...d, ad: val } }))
                    }
                    disabled={!assets}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin asignar</SelectItem>
                      {(assets?.adAccounts ?? []).map((a) => {
                        const owner = takenByOther(a.id, row.clientId);
                        return (
                          <SelectItem key={a.id} value={a.id} disabled={!!owner}>
                            {owner ? (
                              <span className="flex items-center gap-1">
                                <Lock className="w-3 h-3" /> {a.name} — usada por {owner}
                              </span>
                            ) : (
                              `${a.name} · ${a.source}`
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Instagram</p>
                  <Select
                    value={d.ig}
                    onValueChange={(val) =>
                      setDraft((p) => ({ ...p, [row.clientId]: { ...d, ig: val } }))
                    }
                    disabled={!assets}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin asignar</SelectItem>
                      {(assets?.igAccounts ?? []).map((i) => {
                        const owner = takenByOther(i.id, row.clientId);
                        return (
                          <SelectItem key={i.id} value={i.id} disabled={!!owner}>
                            {owner ? (
                              <span className="flex items-center gap-1">
                                <Lock className="w-3 h-3" /> @{i.username || i.id} — usada por{" "}
                                {owner}
                              </span>
                            ) : (
                              `@${i.username || i.id} · ${i.source}`
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => doAssign(row)}
                disabled={busy === row.clientId || !assets}
              >
                Asignar y validar
              </Button>

              {v && (
                <div className="rounded-lg border p-3 space-y-1">
                  {v.reason ? (
                    <p className="text-xs text-destructive font-mono">{v.reason}</p>
                  ) : (
                    <>
                      <CheckLine label="Token" res={v.token} />
                      <CheckLine label="Cuenta publicitaria" res={v.adAccount} />
                      <CheckLine label="Instagram" res={v.instagram} />
                    </>
                  )}
                </div>
              )}

              {s && s.ok !== false && (
                <div className="rounded-lg border p-3 text-xs space-y-1">
                  <p>
                    Anuncios: <strong>{s.adRows}</strong> filas · Publicaciones:{" "}
                    <strong>{s.postRows}</strong> filas
                    {s.igMedia !== null && s.igMedia !== undefined ? (
                      <>
                        {" "}
                        · Instagram: <strong>{s.igMedia}</strong> medios
                      </>
                    ) : null}
                  </p>
                  {s.adsError && <p className="text-destructive font-mono">{s.adsError}</p>}
                  {s.igError && <p className="text-destructive font-mono">{s.igError}</p>}
                </div>
              )}

              {row.lastSyncError && !v && (
                <p className="text-xs text-destructive font-mono">{row.lastSyncError}</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!loading && !loadError && rows.length === 0 && (
        <EmptyState icon={Plug} title="Aún no tienes clientes" size="compact" />
      )}
    </PageContainer>
  );
}
