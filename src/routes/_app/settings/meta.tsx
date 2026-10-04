import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, RefreshCw, Trash2 } from "lucide-react";
import {
  getOrgMetaTokenStatus,
  saveOrgMetaToken,
  clearOrgMetaToken,
  type OrgTokenStatus,
} from "@/lib/meta/connection.functions";
import { validateOrgMetaToken } from "@/lib/meta/bulkConnect.functions";
import { ConfirmDialog, ErrorState, ListSkeleton } from "@/components/app";

export const Route = createFileRoute("/_app/settings/meta")({
  head: () => ({
    meta: [
      { title: "Token de Meta de la organización | Vibranding" },
      {
        name: "description",
        content:
          "Guarda una vez el token de System User de Meta para conectar a todos tus clientes sin volver a pasar por Business Manager.",
      },
      { property: "og:title", content: "Token de Meta de la organización" },
      {
        property: "og:description",
        content: "Un solo token de System User para conectar todos tus clientes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrgMetaTokenPage,
});

function OrgMetaTokenPage() {
  const [status, setStatus] = useState<OrgTokenStatus | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [validatedAt, setValidatedAt] = useState<string | null>(null);
  const [scopes, setScopes] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fetchStatus = useServerFn(getOrgMetaTokenStatus);
  const save = useServerFn(saveOrgMetaToken);
  const clear = useServerFn(clearOrgMetaToken);
  const validate = useServerFn(validateOrgMetaToken);

  const load = async () => {
    try {
      const s = (await fetchStatus({} as any)) as OrgTokenStatus;
      setStatus(s);
      setScopes(s.scopes ?? []);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "No se pudo leer el estado del token");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const doSave = async () => {
    setBusy(true);
    try {
      const res = (await save({ data: { token } })) as any;
      setScopes(res?.assets?.scopes ?? []);
      setValidatedAt(new Date().toISOString());
      setToken("");
      toast.success("Token guardado y validado");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el token");
    } finally {
      setBusy(false);
    }
  };

  const doValidate = async () => {
    setBusy(true);
    try {
      const res = (await validate({} as any)) as any;
      setScopes(res.scopes ?? []);
      setValidatedAt(res.validatedAt);
      toast.success("Token válido según Meta");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "El token no es válido");
    } finally {
      setBusy(false);
    }
  };

  const doClear = async () => {
    try {
      await clear({} as any);
      setScopes([]);
      setValidatedAt(null);
      toast.success("Token eliminado");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> Token de Meta de la organización
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/clients/connect">Conectar clientes</Link>
        </Button>
      </div>

      {loadError ? (
        <ErrorState
          title="No se pudo leer el estado del token"
          message={loadError}
          onRetry={() => {
            setLoadError(null);
            void load();
          }}
        />
      ) : !status ? (
        <Card>
          <CardContent className="pt-6">
            <ListSkeleton rows={3} label="Cargando estado del token" />
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Estado</CardTitle>
          {status?.has_token ? (
            <Badge className="gap-1">
              <ShieldCheck className="w-3 h-3" /> Guardado
            </Badge>
          ) : (
            <Badge variant="secondary">Sin token</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-muted-foreground">
            Organización: <strong>{status?.org_name ?? "—"}</strong>
          </div>
          <div className="text-muted-foreground">
            Expira:{" "}
            {status?.expires_at
              ? new Date(status.expires_at).toLocaleString("es-CL")
              : "sin caducidad"}
            {" · "}Última validación:{" "}
            {validatedAt
              ? new Date(validatedAt).toLocaleString("es-CL")
              : status?.updated_at
                ? new Date(status.updated_at).toLocaleString("es-CL")
                : "nunca"}
          </div>
          <div className="flex flex-wrap gap-1">
            {scopes.length === 0 ? (
              <span className="text-muted-foreground">
                Permisos otorgados por Meta: se muestran al validar.
              </span>
            ) : (
              scopes.map((s) => (
                <Badge key={s} variant="outline" className="font-mono text-[11px]">
                  {s}
                </Badge>
              ))
            )}
          </div>
          {status?.has_token && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={doValidate} disabled={busy}>
                <RefreshCw className={`w-3 h-3 mr-1 ${busy ? "animate-spin" : ""}`} />
                Validar token
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} disabled={busy}>
                <Trash2 className="w-3 h-3 mr-1" /> Eliminar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="¿Eliminar el token de la organización?"
        description="Los tokens por cliente siguen activos. Para conectar clientes nuevos en bloque tendrás que pegar un token otra vez."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          setConfirmClear(false);
          void doClear();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {status?.has_token ? "Reemplazar token" : "Pegar token"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="org-token">Token permanente de System User</Label>
            <Input
              id="org-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAB..."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se cifra en el servidor y nunca vuelve al navegador. Cubre a todos los clientes cuyos
            activos estén compartidos con tu Business Manager.
          </p>
          <Button onClick={doSave} disabled={busy || token.trim().length < 20}>
            Guardar y validar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
