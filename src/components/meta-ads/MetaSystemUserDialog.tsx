import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Building2, KeyRound, Loader2 } from "lucide-react";
import {
  discoverSystemUserToken,
  connectSystemUser,
  listTakenAdAccounts,
  getOrgMetaTokenStatus,
  saveOrgMetaToken,
  discoverOrgMetaAssets,
  type OrgTokenStatus,
} from "@/lib/meta/connection.functions";

type Assets = {
  scopes: string[];
  expiresAt: string | null;
  adAccounts: { id: string; name: string; timezone_name: string | null; source: string }[];
  igAccounts: {
    id: string;
    username: string;
    page_id: string | null;
    page_name: string | null;
    source: string;
  }[];
  warnings: string[];
};

const NONE = "__none__";

export function MetaSystemUserDialog({
  clientId,
  open,
  onOpenChange,
  onConnected,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnected: () => void;
}) {
  const [token, setToken] = useState("");
  const [assets, setAssets] = useState<Assets | null>(null);
  const [adAccountId, setAdAccountId] = useState<string>(NONE);
  const [igAccountId, setIgAccountId] = useState<string>(NONE);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState<Map<string, string>>(new Map());
  const [orgStatus, setOrgStatus] = useState<OrgTokenStatus | null>(null);
  // "org" reuses the workspace token; "client" pastes a token for this client only.
  const [mode, setMode] = useState<"org" | "client">("org");
  const [saveForOrg, setSaveForOrg] = useState(true);

  const discover = useServerFn(discoverSystemUserToken);
  const connect = useServerFn(connectSystemUser);
  const listTaken = useServerFn(listTakenAdAccounts);
  const orgStatusFn = useServerFn(getOrgMetaTokenStatus);
  const saveOrgToken = useServerFn(saveOrgMetaToken);
  const discoverOrg = useServerFn(discoverOrgMetaAssets);

  // An ad account may belong to a single client only, otherwise spend doubles.
  const takenOwner = (id: string) =>
    taken.get(id) ?? taken.get(id.replace(/^act_/, "")) ?? taken.get(`act_${id}`) ?? null;

  const reset = () => {
    setToken("");
    setAssets(null);
    setAdAccountId(NONE);
    setIgAccountId(NONE);
  };

  const loadTaken = async () => {
    const rows = await listTaken({ data: { clientId } });
    const map = new Map(rows.map((r) => [r.adAccountId, r.clientName ?? "otro cliente"]));
    setTaken(map);
    return map;
  };

  const applyAssets = (res: Assets, takenMap: Map<string, string>) => {
    setAssets(res);
    const firstFree = res.adAccounts.find(
      (a) =>
        !takenMap.has(a.id) &&
        !takenMap.has(a.id.replace(/^act_/, "")) &&
        !takenMap.has(`act_${a.id}`),
    );
    setAdAccountId(firstFree?.id ?? NONE);
    setIgAccountId(res.igAccounts[0]?.id ?? NONE);
    if (res.warnings.length) toast.warning(res.warnings.slice(0, 2).join(" · "));
  };

  // With a workspace token available, jump straight to the asset picker.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const status = (await orgStatusFn()) as OrgTokenStatus;
        if (cancelled) return;
        setOrgStatus(status);
        setSaveForOrg(!!status.can_manage);
        if (status.has_token) {
          setMode("org");
          const [res, takenMap] = await Promise.all([
            discoverOrg({ data: { clientId } }) as Promise<Assets>,
            loadTaken(),
          ]);
          if (cancelled) return;
          applyAssets(res, takenMap);
        } else {
          setMode("client");
        }
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? "No se pudo leer el token de la organización");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  const doDiscover = async () => {
    setBusy(true);
    try {
      const takenMap = await loadTaken();
      let res: Assets;
      if (saveForOrg && orgStatus?.can_manage) {
        const saved = (await saveOrgToken({ data: { token: token.trim() } })) as {
          assets: Assets;
        };
        res = saved.assets;
        setOrgStatus((s) => (s ? { ...s, has_token: true } : s));
        setMode("org");
        toast.success("Token guardado para toda la organización");
      } else {
        res = (await discover({ data: { clientId, token: token.trim() } })) as Assets;
      }
      applyAssets(res, takenMap);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer el token");
    } finally {
      setBusy(false);
    }
  };

  const doConnect = async () => {
    if (!assets) return;
    const ad = assets.adAccounts.find((a) => a.id === adAccountId) ?? null;
    if (ad) {
      const owner = takenOwner(ad.id);
      if (owner) {
        toast.error(
          `La cuenta publicitaria ${ad.id} ya está asignada a ${owner}. Desvincúlala de ese cliente primero.`,
        );
        return;
      }
    }
    const ig = assets.igAccounts.find((i) => i.id === igAccountId) ?? null;
    setBusy(true);
    try {
      await connect({
        data: {
          clientId,
          token: mode === "org" ? null : token.trim(),
          useOrgToken: mode === "org",
          adAccountId: ad?.id ?? null,
          igAccountId: ig?.id ?? null,
          pageId: ig?.page_id ?? null,
          businessName: ad?.name ?? ig?.username ?? null,
          timezoneName: ad?.timezone_name ?? null,
          scopes: assets.scopes,
          tokenExpiresAt: assets.expiresAt,
        },
      });

      toast.success(
        mode === "org"
          ? "Cliente conectado con el token de la organización"
          : "Cuenta de Meta conectada con token de System User",
      );
      reset();
      onOpenChange(false);
      onConnected();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo conectar");
    } finally {
      setBusy(false);
    }
  };

  const useClientToken = () => {
    setMode("client");
    setAssets(null);
    setToken("");
    setSaveForOrg(false);
  };

  const backToOrgToken = async () => {
    setMode("org");
    setToken("");
    setAssets(null);
    setBusy(true);
    try {
      const [res, takenMap] = await Promise.all([
        discoverOrg({ data: { clientId } }) as Promise<Assets>,
        loadTaken(),
      ]);
      applyAssets(res, takenMap);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer el token de la organización");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "org" && orgStatus?.has_token ? (
              <>
                <Building2 className="w-4 h-4" /> Conectar con el token de la organización
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" /> Conectar con token de System User
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "org" && orgStatus?.has_token
              ? "Se usa el token guardado para toda la organización. Asigna una cuenta publicitaria y una cuenta de Instagram a este cliente."
              : "Pega un token permanente creado en Business Manager (Configuración del negocio → Usuarios → Usuarios del sistema → Generar token). No requiere App Review. El token se guarda cifrado en el servidor, nunca en el navegador ni en variables de entorno."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "org" && orgStatus?.has_token && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1">
                <Building2 className="w-3 h-3" />
                {orgStatus.org_name ?? "Organización"}
              </Badge>
              <span>
                Token guardado
                {orgStatus.updated_at
                  ? ` el ${new Date(orgStatus.updated_at).toLocaleDateString("es-CL")}`
                  : ""}
                {" · Vence: "}
                {orgStatus.expires_at
                  ? new Date(orgStatus.expires_at).toLocaleString("es-CL")
                  : "nunca"}
              </span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={useClientToken}>
                Usar un token propio para este cliente
              </Button>
            </div>
          )}

          {mode === "client" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="su-token">Token permanente</Label>
                <Input
                  id="su-token"
                  type="password"
                  autoComplete="off"
                  placeholder="EAAG..."
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setAssets(null);
                  }}
                />
              </div>

              {orgStatus?.can_manage && (
                <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="su-org" className="text-sm">
                      Guardar para toda la organización
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Un solo token para todos los clientes cuyos activos estén compartidos con tu
                      Business Manager. No tendrás que volver a pegarlo.
                    </p>
                  </div>
                  <Switch id="su-org" checked={saveForOrg} onCheckedChange={setSaveForOrg} />
                </div>
              )}

              {orgStatus?.has_token && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={backToOrgToken}>
                  Volver al token de la organización
                </Button>
              )}
            </>
          )}

          {mode === "client" && !assets && (
            <Button onClick={doDiscover} disabled={busy || token.trim().length < 20}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Detectar cuentas
            </Button>
          )}

          {mode === "org" && !assets && busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando cuentas disponibles…
            </div>
          )}

          {assets && (
            <>
              <div className="space-y-2">
                <Label>Cuenta publicitaria</Label>
                <Select value={adAccountId} onValueChange={setAdAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin cuenta publicitaria</SelectItem>
                    {assets.adAccounts.map((a) => {
                      const owner = takenOwner(a.id);
                      return (
                        <SelectItem key={a.id} value={a.id} disabled={!!owner}>
                          {a.name} · {a.id} ({a.source}){owner ? ` — ya asignada a ${owner}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cuenta de Instagram</Label>
                <Select value={igAccountId} onValueChange={setIgAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin Instagram</SelectItem>
                    {assets.igAccounts.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.username || i.id}
                        {i.page_name ? ` · ${i.page_name}` : ""} ({i.source})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {assets.warnings.length > 0 && (
                <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {assets.warnings.slice(0, 4).map((w) => (
                      <p key={w}>{w}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Permisos del token: {assets.scopes.length ? assets.scopes.join(", ") : "—"} · Vence:{" "}
                {assets.expiresAt ? new Date(assets.expiresAt).toLocaleString("es-CL") : "nunca"}
              </div>

              <div className="flex justify-end gap-2">
                {mode === "client" && (
                  <Button variant="ghost" onClick={() => setAssets(null)} disabled={busy}>
                    Volver
                  </Button>
                )}
                <Button
                  onClick={doConnect}
                  disabled={busy || (adAccountId === NONE && igAccountId === NONE)}
                >
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Conectar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
