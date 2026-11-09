/**
 * Datos de "Personal" del cliente: empleados del cliente pyme.
 *
 * Fuente única: tabla `public.client_employees` (RLS por cliente; escritura solo
 * para owner/admin/agent del org). Nada se inventa: si no hay filas, la UI
 * muestra un EmptyState honesto.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";

export type Employee = Tables<"client_employees">;
export type EmployeeInsert = TablesInsert<"client_employees">;
export type EmployeeUpdate = TablesUpdate<"client_employees">;

/** Estados posibles de un empleado (igual al CHECK en la BD). */
export const EMPLOYEE_STATUSES = [
  "activo",
  "licencia",
  "vacaciones",
  "permiso",
  "terminado",
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export function isEmployeeStatus(v: unknown): v is EmployeeStatus {
  return typeof v === "string" && (EMPLOYEE_STATUSES as readonly string[]).includes(v);
}

export const EMPLOYEE_STATUS_META: Readonly<
  Record<EmployeeStatus, { label: string; tone: "success" | "warning" | "info" | "neutral" }>
> = {
  activo: { label: "Activo", tone: "success" },
  licencia: { label: "En licencia", tone: "warning" },
  vacaciones: { label: "De vacaciones", tone: "info" },
  permiso: { label: "Permiso", tone: "warning" },
  terminado: { label: "Terminado", tone: "neutral" },
};

/** Rangos sugeridos (texto libre en BD; la UI ofrece estos por defecto). */
export const EMPLOYEE_RANKS = ["Junior", "Semi senior", "Senior", "Líder"] as const;
export type EmployeeRank = (typeof EMPLOYEE_RANKS)[number];

export const employeesKeys = {
  all: (userId: string, clientId: string) => ["client-employees", userId, clientId] as const,
};

/** Trae todos los empleados del cliente, orden descendente por creación. */
export function useClientEmployees(clientId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: employeesKeys.all(userId, clientId),
    enabled: Boolean(userId) && Boolean(clientId),
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("client_employees")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/** Normaliza un email vacío a null; recorta strings. */
function cleanOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export interface EmployeeFormValues {
  full_name: string;
  rut: string;
  email: string;
  phone: string;
  role: string;
  rank: string;
  department: string;
  status: EmployeeStatus;
  started_at: string;
  ended_at: string;
  notes: string;
}

export const emptyEmployeeForm: EmployeeFormValues = {
  full_name: "",
  rut: "",
  email: "",
  phone: "",
  role: "",
  rank: "",
  department: "",
  status: "activo",
  started_at: "",
  ended_at: "",
  notes: "",
};

export function employeeToForm(e: Employee): EmployeeFormValues {
  return {
    full_name: e.full_name,
    rut: e.rut ?? "",
    email: e.email ?? "",
    phone: e.phone ?? "",
    role: e.role ?? "",
    rank: e.rank ?? "",
    department: e.department ?? "",
    status: isEmployeeStatus(e.status) ? e.status : "activo",
    started_at: e.started_at ?? "",
    ended_at: e.ended_at ?? "",
    notes: e.notes ?? "",
  };
}

/** Valores del formulario -> payload para insert/update. */
export function formToPayload(clientId: string, v: EmployeeFormValues): EmployeeInsert {
  return {
    client_id: clientId,
    full_name: v.full_name.trim(),
    rut: cleanOrNull(v.rut),
    email: cleanOrNull(v.email),
    phone: cleanOrNull(v.phone),
    role: cleanOrNull(v.role),
    rank: cleanOrNull(v.rank),
    department: cleanOrNull(v.department),
    status: v.status,
    started_at: cleanOrNull(v.started_at),
    ended_at: cleanOrNull(v.ended_at),
    notes: cleanOrNull(v.notes),
  };
}

/** Crea un empleado del cliente. */
export function useCreateEmployee(clientId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: EmployeeFormValues): Promise<Employee> => {
      const payload = formToPayload(clientId, values);
      const { data, error } = await supabase
        .from("client_employees")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as Employee;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeesKeys.all(user?.id ?? "", clientId),
      });
    },
  });
}

/** Actualiza un empleado del cliente. */
export function useUpdateEmployee(clientId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; values: EmployeeFormValues }): Promise<Employee> => {
      const payload = formToPayload(clientId, args.values);
      // client_id no cambia al editar
      const { client_id: _client_id, ...rest } = payload;
      void _client_id;
      const { data, error } = await supabase
        .from("client_employees")
        .update(rest)
        .eq("id", args.id)
        .eq("client_id", clientId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as Employee;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeesKeys.all(user?.id ?? "", clientId),
      });
    },
  });
}

/** Cambia solo el estado (dropdown de acciones de la tabla). */
export function useSetEmployeeStatus(clientId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      status: EmployeeStatus;
      endedAt?: string | null;
    }): Promise<void> => {
      const patch: EmployeeUpdate = {
        status: args.status,
        ended_at: args.endedAt === undefined ? undefined : args.endedAt,
      };
      const { error } = await supabase
        .from("client_employees")
        .update(patch)
        .eq("id", args.id)
        .eq("client_id", clientId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeesKeys.all(user?.id ?? "", clientId),
      });
    },
  });
}

/** Elimina un empleado del cliente. */
export function useDeleteEmployee(clientId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("client_employees")
        .delete()
        .eq("id", id)
        .eq("client_id", clientId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeesKeys.all(user?.id ?? "", clientId),
      });
    },
  });
}
