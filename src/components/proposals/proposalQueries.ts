import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { publicProposalPath, type ProposalItem } from "@/lib/proposals/model";

export type ProposalRow = Pick<
  Tables<"proposals">,
  | "id"
  | "org_id"
  | "client_id"
  | "prospect_id"
  | "token"
  | "title"
  | "plan_key"
  | "items"
  | "amount_clp"
  | "status"
  | "sent_at"
  | "viewed_at"
  | "accepted_at"
  | "accepted_name"
  | "expires_at"
  | "created_at"
>;

const COLUMNS =
  "id,org_id,client_id,prospect_id,token,title,plan_key,items,amount_clp,status,sent_at,viewed_at,accepted_at,accepted_name,expires_at,created_at";

/** Keys acotadas por usuario: no se comparte caché entre sesiones. */
export const proposalKeys = {
  all: (userId: string) => ["proposals", userId] as const,
  byClient: (userId: string, clientId: string) => ["proposals", userId, "client", clientId] as const,
  one: (userId: string, id: string) => ["proposals", userId, "one", id] as const,
  recipient: (userId: string, kind: string, id: string) => ["proposals", userId, "recipient", kind, id] as const,
};

function useUserKey(): string {
  const { user } = useAuth();
  return user?.id ?? "anon";
}

function writeError(error: { code?: string; message: string }): Error {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return new Error("Tu rol no permite modificar propuestas.");
  }
  return new Error(error.message);
}

export function useClientProposals(clientId: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: proposalKeys.byClient(userKey, clientId),
    queryFn: async (): Promise<ProposalRow[]> => {
      const { data, error } = await supabase
        .from("proposals")
        .select(COLUMNS)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useProposal(id: string) {
  const userKey = useUserKey();
  return useQuery({
    queryKey: proposalKeys.one(userKey, id),
    queryFn: async (): Promise<ProposalRow | null> => {
      const { data, error } = await supabase.from("proposals").select(COLUMNS).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export interface Recipient {
  kind: "client" | "prospect";
  id: string;
  orgId: string;
  name: string;
}

/** Cliente o prospecto destinatario (con su org, necesaria para insertar). */
export function useRecipient(target: { clientId?: string | null; prospectId?: string | null }) {
  const userKey = useUserKey();
  const kind = target.clientId ? "client" : "prospect";
  const id = target.clientId ?? target.prospectId ?? "";
  return useQuery({
    queryKey: proposalKeys.recipient(userKey, kind, id),
    enabled: Boolean(id),
    queryFn: async (): Promise<Recipient | null> => {
      if (kind === "client") {
        const { data, error } = await supabase.from("clients").select("id,org_id,name").eq("id", id).maybeSingle();
        if (error) throw new Error(error.message);
        return data ? { kind, id: data.id, orgId: data.org_id, name: data.name } : null;
      }
      const { data, error } = await supabase.from("prospects").select("id,org_id,nombre").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { kind, id: data.id, orgId: data.org_id, name: data.nombre } : null;
    },
  });
}

export interface ProposalDraft {
  title: string;
  planKey: string | null;
  items: ProposalItem[];
  amountClp: number;
  expiresAt: string | null;
  status: string;
}

function draftColumns(draft: ProposalDraft, previous?: Pick<ProposalRow, "status" | "sent_at">) {
  const becomesSent = draft.status === "enviada" && previous?.status !== "enviada";
  return {
    title: draft.title.trim(),
    plan_key: draft.planKey,
    items: draft.items,
    amount_clp: draft.amountClp,
    expires_at: draft.expiresAt,
    status: draft.status,
    ...(becomesSent && !previous?.sent_at ? { sent_at: new Date().toISOString() } : {}),
  };
}

export function useSaveProposal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userKey = user?.id ?? "anon";
  return useMutation({
    mutationFn: async (input: { recipient: Recipient; draft: ProposalDraft; existing?: ProposalRow }) => {
      const { recipient, draft, existing } = input;
      if (existing) {
        const { data, error } = await supabase
          .from("proposals")
          .update(draftColumns(draft, existing) as TablesUpdate<"proposals">)
          .eq("id", existing.id)
          .neq("status", "aceptada")
          .select("id")
          .maybeSingle();
        if (error) throw writeError(error);
        if (!data) throw new Error("La propuesta ya fue aceptada y no se puede editar.");
        return data.id;
      }
      const { data, error } = await supabase
        .from("proposals")
        .insert({
          ...draftColumns(draft),
          org_id: recipient.orgId,
          client_id: recipient.kind === "client" ? recipient.id : null,
          prospect_id: recipient.kind === "prospect" ? recipient.id : null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw writeError(error);
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: proposalKeys.all(userKey) }),
  });
}

/** borrador → enviada (y sent_at). Solo cambia propuestas en borrador. */
export function useMarkProposalSent() {
  const queryClient = useQueryClient();
  const userKey = useUserKey();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("proposals")
        .update({ status: "enviada", sent_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "borrador")
        .select("id")
        .maybeSingle();
      if (error) throw writeError(error);
      if (!data) throw new Error("La propuesta ya no está en borrador.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: proposalKeys.all(userKey) }),
  });
}

export function publicProposalUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${publicProposalPath(token)}`;
}

/** Copia el link público; devuelve false si el navegador no lo permite. */
export async function copyProposalLink(token: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(publicProposalUrl(token));
    return true;
  } catch {
    return false;
  }
}
