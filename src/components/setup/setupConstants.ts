import type { ComponentType } from "react";
import { Instagram, MessageCircle, Search } from "lucide-react";
import { MetaIcon } from "@/components/icons/MetaIcon";
import type { StatusTone } from "@/components/app";
import type { ConnectionKey, ConnectionStatus, StepState } from "./connectionModel";

export const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "sin registro";

/** Mismos íconos que el menú lateral. */
export const CONNECTION_ICON: Readonly<
  Record<ConnectionKey, ComponentType<{ className?: string }>>
> = {
  instagram: Instagram,
  whatsapp: MessageCircle,
  "meta-ads": MetaIcon,
  "google-ads": Search,
};

export const CONNECTION_STATUS: Readonly<
  Record<ConnectionStatus, { label: string; tone: StatusTone }>
> = {
  connected: { label: "Conectado", tone: "success" },
  pending: { label: "Pendiente", tone: "neutral" },
  error: { label: "Error", tone: "danger" },
};

export const STEP_STATE: Readonly<Record<StepState, { label: string; tone: StatusTone }>> = {
  done: { label: "Listo", tone: "success" },
  available: { label: "Pendiente", tone: "info" },
  blocked: { label: "Bloqueado", tone: "neutral" },
};
