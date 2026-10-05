import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { fichaKeys, formatDate, useUserKey, type FichaOverview } from "./fichaQueries";

const TOKEN_PATTERN = /^[0-9a-f]{48}$/;

interface LinkState {
  token: string;
  expiresAt: string;
}

function parseRpcResult(value: unknown): LinkState | null {
  if (!value || typeof value !== "object") return null;
  const { token, expires_at: expiresAt } = value as Record<string, unknown>;
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token) || typeof expiresAt !== "string")
    return null;
  return { token, expiresAt };
}

/** Link vigente guardado en la ficha (null si no hay o venció). */
export function currentOnboardingLink(overview: FichaOverview): LinkState | null {
  const token = overview.billing?.onboarding_token;
  const expiresAt = overview.billing?.onboarding_token_expires_at;
  if (!token || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
  return { token, expiresAt };
}

/** Genera (o renueva) el link público del formulario de onboarding y permite copiarlo. */
export function OnboardingLinkPanel({
  clientId,
  overview,
}: {
  clientId: string;
  overview: FichaOverview;
}) {
  const queryClient = useQueryClient();
  const [generated, setGenerated] = useState<LinkState | null>(null);
  const [busy, setBusy] = useState(false);
  const userKey = useUserKey();

  // Un link recién generado pertenece a este cliente: no debe sobrevivir a un cambio de cliente.
  useEffect(() => {
    setGenerated(null);
  }, [clientId]);
  const link = generated ?? currentOnboardingLink(overview);
  const url =
    link && typeof window !== "undefined"
      ? `${window.location.origin}/onboarding/${link.token}`
      : null;

  const rotate = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("rotate_onboarding_token", { _client_id: clientId });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("not authorized")
          ? "No tienes permisos para generar el link."
          : error.message,
      );
      return;
    }
    const parsed = parseRpcResult(data);
    if (!parsed) {
      toast.error("La respuesta del servidor no tiene el formato esperado.");
      return;
    }
    setGenerated(parsed);
    void queryClient.invalidateQueries({ queryKey: fichaKeys.overview(userKey, clientId) });
    toast.success(
      link ? "Link renovado; el anterior dejó de funcionar" : "Link de onboarding generado",
    );
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar; selecciónalo y cópialo a mano.");
    }
  };

  return (
    <Panel title="Link de onboarding" icon={Link2}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {link ? `Vence el ${formatDate(link.expiresAt)}` : "Sin link vigente"}
        </p>
        <div className="flex items-center gap-1.5">
          {url && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={copy}>
              <Copy aria-hidden className="mr-1 h-3.5 w-3.5" /> Copiar
            </Button>
          )}
          {overview.canEdit && (
            <Button
              size="sm"
              variant={url ? "ghost" : "default"}
              className="h-7 px-2 text-xs"
              onClick={rotate}
              disabled={busy}
              aria-label={url ? "Generar un link nuevo" : "Generar link de onboarding"}
            >
              <RefreshCw aria-hidden className={`mr-1 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              {url ? "Nuevo" : "Generar link"}
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
