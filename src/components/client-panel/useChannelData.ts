import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  getClientPanelInstagram,
  getClientPanelLeads,
  getClientPanelMessages,
  getClientPanelWhatsApp,
} from "@/lib/client-panel/channels.functions";
import { MESSAGES_PAGE_SIZE, type WhatsAppMessage } from "@/lib/client-panel/channelsModel";
import { usePanelMode } from "./panelMode";

/** Las URLs firmadas de Instagram duran 1 hora: se renuevan antes. */
const SIGNED_STALE_MS = 30 * 60 * 1000;

/**
 * Leads, WhatsApp e Instagram del panel. Solo server functions sobre las RPC
 * client_* (cliente fijo por user_client_id(), o vista previa de la agencia
 * validada en servidor). Nunca un id de cliente propio.
 */
function useScope(section: string) {
  const { user } = useAuth();
  const { preview } = usePanelMode();
  return {
    enabled: Boolean(user?.id),
    key: ["client-panel", user?.id ?? "anon", preview ?? "self", section] as const,
    preview: preview ? { preview } : {},
  };
}

export function usePanelLeads(page: number) {
  const s = useScope("leads");
  const load = useServerFn(getClientPanelLeads);
  return useQuery({
    queryKey: [...s.key, page],
    enabled: s.enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: () => load({ data: { ...s.preview, page } }),
  });
}

export function usePanelWhatsApp(page: number) {
  const s = useScope("whatsapp");
  const load = useServerFn(getClientPanelWhatsApp);
  return useQuery({
    queryKey: [...s.key, page],
    enabled: s.enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: () => load({ data: { ...s.preview, page } }),
  });
}

type Cursor = { before: string; beforeId: string } | null;

/** Mensajes de una conversación, de a páginas hacia atrás (más nuevos primero). */
export function usePanelMessages(conversationId: string) {
  const s = useScope("whatsapp-messages");
  const load = useServerFn(getClientPanelMessages);
  return useInfiniteQuery({
    queryKey: [...s.key, conversationId],
    enabled: s.enabled,
    staleTime: 30_000,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }): Promise<WhatsAppMessage[]> => {
      const res = await load({ data: { ...s.preview, conversationId, cursor: pageParam } });
      if (res.status !== "ok") throw new Error("No pudimos cargar los mensajes.");
      return res.data;
    },
    getNextPageParam: (last): Cursor => {
      const oldest = last[last.length - 1];
      return last.length === MESSAGES_PAGE_SIZE && oldest?.sentAt
        ? { before: oldest.sentAt, beforeId: oldest.id }
        : null;
    },
  });
}

export function usePanelInstagram() {
  const s = useScope("instagram");
  const load = useServerFn(getClientPanelInstagram);
  return useQuery({
    queryKey: s.key,
    enabled: s.enabled,
    staleTime: SIGNED_STALE_MS,
    refetchInterval: SIGNED_STALE_MS,
    queryFn: () => load({ data: s.preview }),
  });
}
