import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LOGO_ERRORS, LOGO_MAX_BYTES, LOGO_TYPES } from "@/lib/clients/logo";
import { refreshClientLogo, uploadClientLogo } from "@/lib/clients/logo.functions";
import { invalidateClientLogos } from "./useClientLogos";

type RefreshMode = "button" | "reset" | "auto";
type LogoResponse = { status: "updated" } | { status: "skipped"; reason: string };

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "No se pudo actualizar el logo";
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/** Valida antes de subir (el servidor vuelve a validar con los bytes reales). */
export function checkLogoFile(file: File): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return LOGO_ERRORS.badType;
  if (file.size === 0) return LOGO_ERRORS.empty;
  if (file.size > LOGO_MAX_BYTES) return LOGO_ERRORS.tooBig;
  return null;
}

/** Actualizar desde Instagram, volver a usar Instagram y subir logo a mano. */
export function useClientLogoActions(clientId: string) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const finish = (res: LogoResponse, okMessage: string) => {
    if (res.status === "updated") {
      toast.success(okMessage);
      void invalidateClientLogos(queryClient);
    } else {
      toast.error(res.reason);
    }
  };

  const refresh = async (mode: Exclude<RefreshMode, "auto">) => {
    setBusy(true);
    try {
      const res = await refreshClientLogo({ data: { clientId, mode } });
      finish(res, "Logo actualizado desde Instagram");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    const invalid = checkLogoFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    try {
      const dataBase64 = await readBase64(file);
      const res = await uploadClientLogo({
        data: { clientId, contentType: file.type, dataBase64 },
      });
      finish(res, "Logo subido");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return { busy, refresh, upload };
}

/**
 * Tras crear un cliente o cambiar su @: intenta traer el logo sin bloquear.
 * Un logo subido a mano no se toca; otros motivos (cuenta personal) se avisan.
 */
export async function fetchLogoAfterHandleChange(
  clientId: string,
  invalidate: () => Promise<unknown>,
): Promise<void> {
  try {
    const res = await refreshClientLogo({ data: { clientId, mode: "auto" } });
    if (res.status === "updated") {
      await invalidate();
      return;
    }
    if (res.reason !== LOGO_ERRORS.manualLocked) {
      toast.message("No se pudo traer el logo desde Instagram", { description: res.reason });
    }
  } catch (e) {
    console.error("[client-logo] auto refresh failed", clientId, e);
  }
}
