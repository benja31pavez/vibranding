import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Copy, CheckCircle2, Plug, AlertCircle, ChevronDown } from "lucide-react";
import { getWhatsAppVerifyToken, setWhatsAppAccessToken } from "@/lib/whatsapp/account.functions";
import type { WAAccount } from "@/components/pages/ChatbotPage";

export function ConnectWhatsAppCard({
  clientId,
  account,
  onChange,
}: {
  clientId: string;
  account: WAAccount | null;
  onChange: () => void;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(account?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(account?.waba_id ?? "");
  const [displayPhone, setDisplayPhone] = useState(account?.display_phone_number ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(!account?.connected);
  const [verifyToken, setVerifyToken] = useState("");
  const getVerifyToken = useServerFn(getWhatsAppVerifyToken);
  const storeAccessToken = useServerFn(setWhatsAppAccessToken);

  const revealVerifyToken = async (): Promise<string | null> => {
    if (!account) return null;
    try {
      const res = (await getVerifyToken({ data: { accountId: account.id } })) as {
        verifyToken: string;
      };
      setVerifyToken(res.verifyToken);
      return res.verifyToken;
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo obtener el token");
      return null;
    }
  };

  useEffect(() => {
    setPhoneNumberId(account?.phone_number_id ?? "");
    setWabaId(account?.waba_id ?? "");
    setDisplayPhone(account?.display_phone_number ?? "");
    setDetailsOpen(!account?.connected);
    setVerifyToken("");
  }, [account]);

  const webhookUrl = account
    ? `https://vibranding.pro/api/public/whatsapp/webhook/${account.id}`
    : "";

  const ensureAccount = async (): Promise<WAAccount | null> => {
    if (account) return account;
    const { data: created, error } = await supabase
      .from("whatsapp_accounts")
      .insert({ client_id: clientId })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    const { data } = await (supabase.from("whatsapp_accounts_safe" as any) as any)
      .select("*")
      .eq("id", created.id)
      .maybeSingle();
    onChange();
    return (data ?? null) as WAAccount | null;
  };

  const save = async () => {
    setSaving(true);
    const a = await ensureAccount();
    if (!a) {
      setSaving(false);
      return;
    }
    // The token itself is stored encrypted server-side, never in the table.
    if (accessToken) {
      try {
        await storeAccessToken({ data: { accountId: a.id, token: accessToken } });
      } catch (e: any) {
        setSaving(false);
        return toast.error(e?.message ?? "No se pudo guardar el token");
      }
    }
    const { error } = await supabase
      .from("whatsapp_accounts")
      .update({
        phone_number_id: phoneNumberId || null,
        waba_id: wabaId || null,
        display_phone_number: displayPhone || null,
        connected: !!(phoneNumberId && (accessToken || a.has_access_token)),
      })
      .eq("id", a.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setAccessToken("");
    toast.success("Conexión guardada");
    onChange();
  };

  const disconnect = async () => {
    if (!account) return;
    if (!confirm("¿Desconectar WhatsApp? Los mensajes históricos se conservan.")) return;
    try {
      await storeAccessToken({ data: { accountId: account.id, token: null } });
    } catch (e: any) {
      return toast.error(e?.message ?? "No se pudo desconectar");
    }
    const { error } = await supabase
      .from("whatsapp_accounts")
      .update({ connected: false })
      .eq("id", account.id);
    if (error) return toast.error(error.message);
    onChange();
  };

  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast.success(`${label} copiado`);
  };

  const initOrSetup = async () => {
    await ensureAccount();
  };

  if (!account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" /> Conectar WhatsApp Business
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Conectaremos un número de WhatsApp Business via Meta Cloud API. Necesitarás una App en
            Meta for Developers y un número verificado en tu WhatsApp Business Account (WABA).
          </p>
          <Button onClick={initOrSetup}>Iniciar configuración</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex items-center gap-2 text-left">
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${detailsOpen ? "rotate-180" : ""}`}
              />
              <span className="flex items-center gap-2 font-semibold leading-none tracking-tight">
                <Plug className="w-5 h-5" />
                {account.connected ? "WhatsApp conectado" : "Configurar WhatsApp"}
                {account.connected ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Activo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="w-3 h-3" /> Pendiente
                  </Badge>
                )}
              </span>
            </button>
          </CollapsibleTrigger>
          {account.connected && (
            <Button variant="ghost" size="sm" onClick={disconnect}>
              Desconectar
            </Button>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Webhook (configurar en Meta → WhatsApp → Configuration)
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Callback URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => copy(webhookUrl, "URL")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Verify Token</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={verifyToken}
                      placeholder="•••••••• (oculto)"
                      className="font-mono text-xs"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={async () => {
                        const t = verifyToken || (await revealVerifyToken());
                        if (t) copy(t, "Token");
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Suscríbete al campo <code className="font-mono">messages</code> para recibir
                  mensajes.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Phone Number ID</Label>
                <Input
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="123456789012345"
                />
              </div>
              <div>
                <Label className="text-xs">WhatsApp Business Account ID (WABA)</Label>
                <Input
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder="987654321098765"
                />
              </div>
              <div>
                <Label className="text-xs">Número visible (opcional)</Label>
                <Input
                  value={displayPhone}
                  onChange={(e) => setDisplayPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div>
                <Label className="text-xs">
                  Access Token permanente {account.has_access_token && "(guardado)"}
                </Label>
                <Input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={
                    account.has_access_token ? "•••••••• (dejar vacío para mantener)" : "EAAG..."
                  }
                />
              </div>
            </div>

            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar conexión"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
