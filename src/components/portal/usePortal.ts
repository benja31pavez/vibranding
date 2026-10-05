import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  decidePortalItem,
  getPortalCalendar,
  getPortalSnapshot,
} from "@/lib/portal/portal.functions";
import type { PortalDecision, PortalItemKind } from "@/lib/portal/model";

/** Modo del portal: el cliente real o la vista previa (solo lectura) del equipo. */
export type PortalMode = { kind: "client" } | { kind: "preview"; clientId: string };

const previewId = (mode: PortalMode) => (mode.kind === "preview" ? mode.clientId : undefined);

export const portalKeys = {
  all: (userId: string, mode: PortalMode) =>
    ["portal-v2", userId, previewId(mode) ?? "self"] as const,
  snapshot: (userId: string, mode: PortalMode) =>
    [...portalKeys.all(userId, mode), "snapshot"] as const,
  calendar: (userId: string, mode: PortalMode, month: string) =>
    [...portalKeys.all(userId, mode), "calendar", month] as const,
};

export function usePortalSnapshot(mode: PortalMode) {
  const { user } = useAuth();
  const fetchSnapshot = useServerFn(getPortalSnapshot);
  return useQuery({
    queryKey: portalKeys.snapshot(user?.id ?? "anon", mode),
    enabled: Boolean(user?.id),
    queryFn: () => fetchSnapshot({ data: { previewClientId: previewId(mode) } }),
  });
}

export function usePortalCalendar(mode: PortalMode, month: string, enabled: boolean) {
  const { user } = useAuth();
  const fetchCalendar = useServerFn(getPortalCalendar);
  return useQuery({
    queryKey: portalKeys.calendar(user?.id ?? "anon", mode, month),
    enabled: Boolean(user?.id) && enabled,
    queryFn: () => fetchCalendar({ data: { month, previewClientId: previewId(mode) } }),
  });
}

export interface DecisionVars {
  kind: PortalItemKind;
  id: string;
  decision: PortalDecision;
  note: string;
}

/** Aprobar / pedir cambios. Al terminar (bien, mal o "ya revisado") recarga el portal. */
export function usePortalDecision(mode: PortalMode) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const decide = useServerFn(decidePortalItem);
  return useMutation({
    mutationFn: (vars: DecisionVars) => decide({ data: vars }),
    onSuccess: (result, vars) => {
      if (!result.ok) {
        toast.info("Esto ya fue revisado", { description: "Actualizamos la lista con lo último." });
        return;
      }
      if (vars.decision === "approve") {
        toast.success("¡Listo! Quedó aprobado", {
          description: "Le avisamos a tu equipo de Vibranding.",
        });
      } else if (result.noteSaved) {
        toast.success("Enviamos tus comentarios", {
          description: "Tu equipo hará los cambios y te avisará.",
        });
      } else {
        toast.warning("Marcamos el post para cambios", {
          description:
            "No pudimos adjuntar tu nota. Escríbele a tu equipo con el detalle, por favor.",
        });
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar tu respuesta.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: portalKeys.all(user?.id ?? "anon", mode) });
    },
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Intenta de nuevo en un momento.";
}
