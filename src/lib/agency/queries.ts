import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Datos de la propia agencia: org del usuario, miembros, perfil legal, cuentas
 * bancarias, empleados y gastos. Las consultas usan RLS (nadie ve otra org).
 *
 * `useCurrentOrg` resuelve la primera (y en la práctica única) org a la que
 * pertenece el usuario, junto con su rol. Hooks posteriores dependen de `orgId`.
 */

export type OrgRole = "owner" | "admin" | "agent" | "viewer";
export const ORG_MANAGER_ROLES: readonly OrgRole[] = ["owner", "admin"];

export interface CurrentOrg {
  orgId: string;
  role: OrgRole;
  name: string;
}

export const agencyKeys = {
  org: (userId: string) => ["mi-agencia", "org", userId] as const,
  members: (userId: string, orgId: string) => ["mi-agencia", "members", userId, orgId] as const,
  profile: (userId: string, orgId: string) => ["mi-agencia", "profile", userId, orgId] as const,
  banks: (userId: string, orgId: string) => ["mi-agencia", "banks", userId, orgId] as const,
  employees: (userId: string, orgId: string) => ["mi-agencia", "employees", userId, orgId] as const,
  expenses: (userId: string, orgId: string) => ["mi-agencia", "expenses", userId, orgId] as const,
  clientsSummary: (userId: string, orgId: string) =>
    ["mi-agencia", "clients-summary", userId, orgId] as const,
  payments: (userId: string, orgId: string) => ["mi-agencia", "payments", userId, orgId] as const,
} as const;

export function invalidateAgency(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["mi-agencia"] });
}

function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
}

/**
 * Org del usuario autenticado. Devuelve null si no es miembro de ninguna (p. ej.
 * usuario cliente): las pantallas de /mi-agencia muestran un estado vacío.
 */
export function useCurrentOrg() {
  const userId = useUserId();
  return useQuery({
    queryKey: agencyKeys.org(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<CurrentOrg | null> => {
      const { data: member, error: mErr } = await supabase
        .from("org_members")
        .select("org_id,role,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (mErr) throw new Error(mErr.message);
      if (!member) return null;
      const orgId = (member as { org_id: string }).org_id;
      const role = ((member as { role: string }).role ?? "viewer") as OrgRole;
      const { data: org, error: oErr } = await supabase
        .from("orgs")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      if (oErr) throw new Error(oErr.message);
      return { orgId, role, name: (org as { name?: string } | null)?.name ?? "Mi agencia" };
    },
  });
}

export interface OrgMemberRow {
  id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

/** Miembros de la org con su rol y el perfil (si existe en `user_profiles`). */
export function useOrgMembers(orgId: string | null | undefined) {
  const userId = useUserId();
  const effective = orgId ?? "";
  return useQuery({
    queryKey: agencyKeys.members(userId, effective),
    enabled: Boolean(userId && effective),
    queryFn: async (): Promise<OrgMemberRow[]> => {
      const { data: members, error } = await supabase
        .from("org_members")
        .select("id,user_id,role,created_at")
        .eq("org_id", effective)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      const base = (members ?? []) as ReadonlyArray<{
        id: string;
        user_id: string;
        role: string;
        created_at: string;
      }>;
      const userIds = base.map((m) => m.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("user_profiles")
        .select("user_id,full_name,avatar_url,job_title")
        .in("user_id", userIds);
      if (pErr) throw new Error(pErr.message);
      const byUser = new Map(
        (
          (profiles ?? []) as ReadonlyArray<{
            user_id: string;
            full_name: string | null;
            avatar_url: string | null;
            job_title: string | null;
          }>
        ).map((p) => [p.user_id, p]),
      );
      return base.map((m) => {
        const profile = byUser.get(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as OrgRole,
          created_at: m.created_at,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          job_title: profile?.job_title ?? null,
        };
      });
    },
  });
}

export interface AgencyProfile {
  id: string;
  org_id: string;
  legal_name: string;
  rut: string;
  giro: string;
  address: string;
  commune: string;
  city: string;
  legal_representative: string;
  legal_representative_rut: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  billing_notes: string;
}

export function useAgencyProfile(orgId: string | null | undefined) {
  const userId = useUserId();
  const effective = orgId ?? "";
  return useQuery({
    queryKey: agencyKeys.profile(userId, effective),
    enabled: Boolean(userId && effective),
    queryFn: async (): Promise<AgencyProfile | null> => {
      const { data, error } = await supabase
        .from("agency_profile")
        .select(
          "id,org_id,legal_name,rut,giro,address,commune,city,legal_representative,legal_representative_rut,contact_email,contact_phone,website,billing_notes",
        )
        .eq("org_id", effective)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as AgencyProfile | null) ?? null;
    },
  });
}

export interface BankAccountRow {
  id: string;
  org_id: string;
  bank_code: string;
  account_type: string;
  account_number: string;
  holder_name: string;
  holder_rut: string;
  holder_email: string;
  label: string;
  is_primary: boolean;
  notes: string;
  created_at: string;
}

export function useBankAccounts(orgId: string | null | undefined) {
  const userId = useUserId();
  const effective = orgId ?? "";
  return useQuery({
    queryKey: agencyKeys.banks(userId, effective),
    enabled: Boolean(userId && effective),
    queryFn: async (): Promise<BankAccountRow[]> => {
      const { data, error } = await supabase
        .from("agency_bank_accounts")
        .select(
          "id,org_id,bank_code,account_type,account_number,holder_name,holder_rut,holder_email,label,is_primary,notes,created_at",
        )
        .eq("org_id", effective)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as BankAccountRow[];
    },
  });
}

export interface EmployeeRow {
  id: string;
  org_id: string;
  user_id: string | null;
  display_name: string;
  title: string;
  area: string;
  phone: string;
  email: string;
  started_at: string | null;
  ended_at: string | null;
  notes: string;
}

export function useAgencyEmployees(orgId: string | null | undefined) {
  const userId = useUserId();
  const effective = orgId ?? "";
  return useQuery({
    queryKey: agencyKeys.employees(userId, effective),
    enabled: Boolean(userId && effective),
    queryFn: async (): Promise<EmployeeRow[]> => {
      const { data, error } = await supabase
        .from("agency_employees")
        .select("id,org_id,user_id,display_name,title,area,phone,email,started_at,ended_at,notes")
        .eq("org_id", effective)
        .order("started_at", { ascending: true, nullsFirst: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as EmployeeRow[];
    },
  });
}

export interface ExpenseRow {
  id: string;
  org_id: string;
  expense_date: string;
  supplier: string;
  concept: string;
  category: string;
  net_amount: number;
  iva_amount: number;
  total_amount: number;
  currency: string;
  document_type: string;
  document_number: string;
  payment_method: string;
  notes: string;
}

export function useAgencyExpenses(orgId: string | null | undefined) {
  const userId = useUserId();
  const effective = orgId ?? "";
  return useQuery({
    queryKey: agencyKeys.expenses(userId, effective),
    enabled: Boolean(userId && effective),
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from("agency_expenses")
        .select(
          "id,org_id,expense_date,supplier,concept,category,net_amount,iva_amount,total_amount,currency,document_type,document_number,payment_method,notes",
        )
        .eq("org_id", effective)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ExpenseRow[];
    },
  });
}

export interface ClientsSummary {
  total: number;
  activos: number;
  onboarding: number;
  pausados: number;
  prospectos: number;
  terminados: number;
}

export function useClientsSummary(orgId: string | null | undefined) {
  const userId = useUserId();
  const effective = orgId ?? "";
  return useQuery({
    queryKey: agencyKeys.clientsSummary(userId, effective),
    enabled: Boolean(userId && effective),
    queryFn: async (): Promise<ClientsSummary> => {
      const { data, error } = await supabase
        .from("clients")
        .select("status")
        .eq("org_id", effective);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as ReadonlyArray<{ status: string }>;
      return rows.reduce<ClientsSummary>(
        (acc, c) => {
          acc.total += 1;
          if (c.status === "activo") acc.activos += 1;
          else if (c.status === "onboarding") acc.onboarding += 1;
          else if (c.status === "pausado") acc.pausados += 1;
          else if (c.status === "prospecto") acc.prospectos += 1;
          else if (c.status === "terminado") acc.terminados += 1;
          return acc;
        },
        { total: 0, activos: 0, onboarding: 0, pausados: 0, prospectos: 0, terminados: 0 },
      );
    },
  });
}

export interface AgencyPaymentRow {
  id: string;
  client_id: string;
  client_name: string;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  period: string | null;
}

/** Todos los cobros/pagos de la org, con nombre de cliente. Reutiliza RLS. */
export function useAgencyPayments(orgId: string | null | undefined) {
  const userId = useUserId();
  const effective = orgId ?? "";
  return useQuery({
    queryKey: agencyKeys.payments(userId, effective),
    enabled: Boolean(userId && effective),
    queryFn: async (): Promise<AgencyPaymentRow[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id,client_id,description,amount,currency,status,due_date,paid_at,period,clients!inner(name,org_id)",
        )
        .eq("clients.org_id", effective)
        .order("due_date", { ascending: false, nullsFirst: false })
        .order("id");
      if (error) throw new Error(error.message);
      return (
        (data ?? []) as ReadonlyArray<{
          id: string;
          client_id: string;
          description: string | null;
          amount: number | string;
          currency: string;
          status: string;
          due_date: string | null;
          paid_at: string | null;
          period: string | null;
          clients: { name: string } | null;
        }>
      ).map((p) => ({
        id: p.id,
        client_id: p.client_id,
        client_name: p.clients?.name ?? "—",
        description: p.description,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        due_date: p.due_date,
        paid_at: p.paid_at,
        period: p.period,
      }));
    },
  });
}
