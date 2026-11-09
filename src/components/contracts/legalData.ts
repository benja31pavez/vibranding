/**
 * Consultas de la pantalla Legal (Resumen, Firmas y Plantillas). La subsección
 * Documentos usa `ContractsPage`, que carga y escribe por su cuenta; estas keys
 * se invalidan al cambiar un contrato desde Firmas.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fichaKeys, useUserKey } from "@/components/clients/ficha/fichaQueries";
import { loadPricing, type PricingSettings } from "@/components/PricingPanel";
import type { ContractStatus } from "./contractModel";

export const legalKeys = {
  all: (userId: string, clientId: string) => ["legal", userId, clientId] as const,
  contracts: (userId: string, clientId: string) =>
    ["legal", userId, clientId, "contracts"] as const,
  intake: (userId: string, clientId: string) => ["legal", userId, clientId, "intake"] as const,
  pricing: (userId: string) => ["legal", userId, "pricing"] as const,
};

/** Lo que Legal necesita de cada contrato (sin los snapshots pesados). */
export interface LegalContract {
  id: string;
  title: string;
  status: ContractStatus;
  currency: string;
  total_one_time: number;
  total_monthly: number;
  effective_date: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  services_snapshot: unknown;
  client_snapshot: unknown;
}

export function useLegalContracts(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: legalKeys.contracts(userKey, clientId),
    queryFn: async (): Promise<LegalContract[]> => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select(
          "id,title,status,currency,total_one_time,total_monthly,effective_date,signed_at,created_at,updated_at,services_snapshot,client_snapshot",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((c) => ({
        ...c,
        total_one_time: Number(c.total_one_time),
        total_monthly: Number(c.total_monthly),
      })) as LegalContract[];
    },
  });
}

/** Datos del cliente para contratos, desde la ficha de onboarding (`client_intake`). */
export interface ContractIntake {
  razon_social: string;
  rut: string | null;
  direccion: string | null;
  email_facturacion: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  submitted_at: string;
}

export function useContractIntake(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: legalKeys.intake(userKey, clientId),
    queryFn: async (): Promise<ContractIntake | null> => {
      const { data, error } = await supabase
        .from("client_intake")
        .select(
          "razon_social,rut,direccion,email_facturacion,contacto_nombre,contacto_email,submitted_at",
        )
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** Configuración de Precios del usuario (cláusulas y datos de la agencia), solo lectura. */
export function useContractPricing() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: legalKeys.pricing(userId),
    enabled: Boolean(userId),
    queryFn: (): Promise<PricingSettings | null> => loadPricing(userId),
  });
}

/** RLS oculta filas en vez de fallar: 0 filas afectadas significa "sin permiso". */
const NO_PERMISSION = "No tienes permisos para esta acción";

/** Cambia el estado de un contrato (p. ej. marcar firmado) e invalida Legal y la ficha. */
export function useSetContractStatus(clientId: string) {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  return async (id: string, status: ContractStatus): Promise<boolean> => {
    const patch: { status: ContractStatus; signed_at?: string } = { status };
    if (status === "signed") patch.signed_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("client_contracts")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error || !data || data.length === 0) {
      toast.error(NO_PERMISSION);
      return false;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: legalKeys.all(userKey, clientId) }),
      queryClient.invalidateQueries({ queryKey: fichaKeys.contract(userKey, clientId) }),
    ]);
    return true;
  };
}
