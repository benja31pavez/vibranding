import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { discoverSystemUserToken, connectSystemUser } from "@/lib/meta/connection.functions";

type Assets = {
  scopes: string[];
  expiresAt: string | null;
  adAccounts: { id: string; name: string; timezone_name: string | null; source: string }[];
  igAccounts: { id: string; username: string; page_id: string | null; page_name: string | null; source: string }[];
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

  const discover = useServerFn(discoverSystemUserToken);
  const connect = useServerFn(connectSystemUser);

  const reset = () => {
    setToken("");
    setAssets(null);
    setAdAccountId(NONE);
    setIgAccountId(NONE);
  };

  const doDiscover = async () => {
    setBusy(true);
    try {
      const res = (await discover({ data: { clientId, token: token.trim() } })) as Assets;
      setAssets(res);
      setAdAccountId(res.adAccounts[0]?.id ?? NONE);
      setIgAccountId(res.igAccounts[0]?.id ?? NONE);
      if (res.warnings.length) toast.warning(res.warnings.slice(0, 2).join(" · "));
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer el token");
    } finally {
      setBusy(false);
    }
  };

  const doConnect = async () => {
    if (!assets) return;
    const ad = assets.adAccounts.find((a) => a.id === adAccountId) ?? null;
    const ig = assets.igAccounts.find((i) => i.id === igAccountId) ?? null;
    setBusy(true);
    try {
      const res = (await connect({
        data: {
          clientId,
          token: token.trim(),
          adAccountId: ad?.id ?? null,
          igAccountId: ig?.id ?? null,
          pageId: ig?.page_id ?? null,
          businessName: ad?.name ?? ig?.username ?? null,
          timezoneName: ad?.timezone_name ?? null,
          scopes: assets.scopes,
          tokenExpiresAt: assets.expiresAt,
        },
      })) as { conflicts: { clientId: string; clientName: string | null }[] };

      if (res.conflicts?.length) {
        toast.warning(
          `Atención: esta cuenta publicitaria ya está asignada a ${res.conflicts
            .map((c) => c.clientName ?? c.clientId)
            .join(", ")}. El gasto se contaría dos veces.`,
          { duration: 12000 },
        );
      } else {
        toast.success("Cuenta de Meta conectada con token de System User");
      }
      reset();
      onOpenChange(false);
      onConnected();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo conectar");
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
            <KeyRound className="w-4 h-4" /> Conectar con token de System User
          </DialogTitle>
          <DialogDescription>
            Pega un token permanente creado en Business Manager (Configuración del negocio →
            Usuarios → Usuarios del sistema → Generar token). No requiere App Review. El token se
            guarda cifrado en el servidor, nunca en el navegador ni en variables de entorno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {!assets && (
            <Button onClick={doDiscover} disabled={busy || token.trim().length < 20}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Detectar cuentas
            </Button>
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
                    {assets.adAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.id} ({a.source})
                      </SelectItem>
                    ))}
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
                Permisos del token: {assets.scopes.length ? assets.scopes.join(", ") : "—"} ·
                Vence: {assets.expiresAt ? new Date(assets.expiresAt).toLocaleString("es-CL") : "nunca"}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAssets(null)} disabled={busy}>
                  Volver
                </Button>
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
