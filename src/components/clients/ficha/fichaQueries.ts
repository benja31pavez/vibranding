import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { StatusTone } from "@/components/app";
import { useAuth } from "@/hooks/use-auth";

/** Etapas comerciales de `clients.status` (CHECK clients_status_chk). */
export const CLIENT_STATUSES = [
  "prospecto",
  "onboarding",
  "activo",
  "pausado",
  "terminado",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_META: Readonly<
  Record<ClientStatus, { label: string; tone: StatusTone }>
> = {
  prospecto: { label: "Prospecto", tone: "info" },
  onboarding: { label: "Onboarding", tone: "warning" },
  activo: { label: "Activo", tone: "success" },
  pausado: { label: "Pausado", tone: "warning" },
  terminado: { label: "Terminado", tone: "neutral" },
};

export function isClientStatus(value: string | null | undefined): value is ClientStatus {
  return (CLIENT_STATUSES as readonly string[]).includes(value ?? "");
}

/** Keys de React Query de la ficha, acotadas por usuario (no se comparte caché entre sesiones). */
export const fichaKeys = {
  all: (userId: string, clientId: string) => ["ficha", userId, clientId] as const,
  overview: (userId: string, clientId: string) => ["ficha", userId, clientId, "overview"] as const,
  health: (userId: string, clientId: string) => ["ficha", userId, clientId, "health"] as const,
  contract: (userId: string, clientId: string) => ["ficha", userId, clientId, "contract"] as const,
  intake: (userId: string, clientId: string) => ["ficha", userId, clientId, "intake"] as const,
  exists: (userId: string, clientId: string) => ["client-exists", userId, clientId] as const,
};

/** Id del usuario actual para acotar las keys ("anon" mientras carga la sesión). */
export function useUserKey(): string {
  const { user } = useAuth();
  return user?.id ?? "anon";
}

/** Mensaje legible para errores de escritura; los de RLS/privilegios → "sin permisos". */
export function writeErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return PERMISSION_DENIED_MSG;
  }
  return error.message;
}

export type ClientBilling = Pick<
  Tables<"client_billing">,
  "plan_key" | "mrr" | "billing_day" | "onboarding_token" | "onboarding_token_expires_at"
>;

export interface FichaOverview {
  status: string;
  startedAt: string | null;
  billing: ClientBilling | null;
  canEdit: boolean;
}

/** Datos comerciales del cliente: etapa, inicio, facturación y si el usuario puede editar. */
export function useFichaOverview(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: fichaKeys.overview(userKey, clientId),
    queryFn: async (): Promise<FichaOverview> => {
      const [clientRes, billingRes, editRes] = await Promise.all([
        supabase.from("clients").select("status,started_at").eq("id", clientId).maybeSingle(),
        supabase
          .from("client_billing")
          .select("plan_key,mrr,billing_day,onboarding_token,onboarding_token_expires_at")
          .eq("client_id", clientId)
          .maybeSingle(),
        supabase.rpc("can_edit_client", { _client_id: clientId }),
      ]);
      if (clientRes.error) throw new Error(clientRes.error.message);
      if (billingRes.error) throw new Error(billingRes.error.message);
      return {
        status: clientRes.data?.status ?? "activo",
        startedAt: clientRes.data?.started_at ?? null,
        billing: billingRes.data ?? null,
        // Si la función falla, asumimos lectura: la BD igual valida en cada escritura.
        canEdit: editRes.error ? false : Boolean(editRes.data),
      };
    },
  });
}

export type ApprovalItem = Pick<
  Tables<"approval_queue">,
  "kind" | "ref_id" | "title" | "created_at" | "url_hint"
>;
export type OpenPayment = Pick<
  Tables<"payments">,
  "id" | "amount" | "currency" | "status" | "due_date" | "description"
>;
export type OpenAlert = Pick<
  Tables<"campaign_alerts">,
  "id" | "client_id" | "severity" | "message" | "platform" | "created_at" | "data" | "kind"
>;

export interface FichaHealth {
  approvals: ApprovalItem[];
  payments: OpenPayment[];
  alerts: OpenAlert[];
}

/** Lo que está pendiente con el cliente: aprobaciones, cobros abiertos y alertas de campañas. */
export function useFichaHealth(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: fichaKeys.health(userKey, clientId),
    queryFn: async (): Promise<FichaHealth> => {
      const [approvalsRes, paymentsRes, alertsRes] = await Promise.all([
        supabase
          .from("approval_queue")
          .select("kind,ref_id,title,created_at,url_hint")
          .eq("client_id", clientId)
          .order("created_at", { ascending: true })
          .limit(50),
        supabase
          .from("payments")
          .select("id,amount,currency,status,due_date,description")
          .eq("client_id", clientId)
          .in("status", ["pending", "overdue"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(100),
        supabase
          .from("campaign_alerts")
          .select("id,client_id,severity,message,platform,created_at,data,kind")
          .eq("client_id", clientId)
          .is("resolved_at", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      const firstError = approvalsRes.error ?? paymentsRes.error ?? alertsRes.error;
      if (firstError) throw new Error(firstError.message);
      return {
        approvals: approvalsRes.data ?? [],
        payments: paymentsRes.data ?? [],
        alerts: alertsRes.data ?? [],
      };
    },
  });
}

/** Fecha (YYYY-MM-DD o ISO) → "4 oct 2026". Las fechas sin hora se leen como locales. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

export const PERMISSION_DENIED_MSG = "No tienes permisos para editar este cliente.";
