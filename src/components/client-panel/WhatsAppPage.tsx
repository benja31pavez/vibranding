import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Bot,
  Check,
  CheckCheck,
  CircleAlert,
  MessageCircle,
  SendHorizontal,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  FitPage,
  FitPager,
  ListSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/app";
import { cn } from "@/lib/utils";
import {
  CONVERSATIONS_PAGE_SIZE,
  MESSAGES_PAGE_SIZE,
  fetchWhatsAppConversations,
  fetchWhatsAppLine,
  fetchWhatsAppMessages,
  type WhatsAppConversation,
  type WhatsAppLine,
  type WhatsAppMessage,
} from "./clientData";
import { chileDateKey, formatChatTime, formatDay, formatTime } from "./format";
import { useActiveClientSelf } from "./useClientSelf";

const UNSUPPORTED = "Mensaje no compatible";

/** Texto visible de un mensaje o vista previa (los no-texto no traen cuerpo). */
function messageText(body: string | null, type = "text"): string {
  if (!body || body === "[unsupported]") {
    if (type === "image") return "Imagen";
    if (type === "audio") return "Audio";
    if (type === "video") return "Video";
    if (type === "document") return "Documento";
    return UNSUPPORTED;
  }
  return body;
}

/** Bandeja de WhatsApp del cliente: lectura de todas sus conversaciones. Responder = fase 3. */
export function WhatsAppPage() {
  const self = useActiveClientSelf();
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const line = useQuery({
    queryKey: ["client-panel", self.id, "whatsapp", "line"],
    queryFn: fetchWhatsAppLine,
    staleTime: 5 * 60_000,
  });
  const conversations = useQuery({
    queryKey: ["client-panel", self.id, "whatsapp", "conversations", page],
    queryFn: () => fetchWhatsAppConversations(page),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const items = conversations.data?.items ?? [];
  const active = items.find((c) => c.id === selectedId) ?? items[0] ?? null;
  const total = conversations.data?.total ?? 0;

  const header = (
    <PageHeader
      size="compact"
      title="WhatsApp"
      actions={line.data ? <LineBadge line={line.data} /> : undefined}
    />
  );

  if (line.isPending || conversations.isPending) {
    return (
      <FitPage header={header}>
        <Panel>
          <ListSkeleton rows={5} label="Cargando conversaciones…" />
        </Panel>
      </FitPage>
    );
  }
  const failed = line.isError ? line : conversations.isError ? conversations : null;
  if (failed) {
    return (
      <FitPage header={header}>
        <ErrorState
          message={failed.error?.message}
          onRetry={() => {
            void line.refetch();
            void conversations.refetch();
          }}
        />
      </FitPage>
    );
  }
  if (total === 0) {
    return (
      <FitPage header={header}>
        <OneLineState
          text={
            line.data?.connected
              ? "Aún no hay conversaciones."
              : "Tu WhatsApp aún no está conectado: tu equipo VIBRANDING lo está configurando."
          }
        />
      </FitPage>
    );
  }

  return (
    <FitPage
      header={header}
      contentClassName="grid gap-4 md:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]"
    >
      <Panel
        fill
        title={`${total} ${total === 1 ? "conversación" : "conversaciones"}`}
        actions={
          <FitPager
            page={page}
            pageCount={Math.ceil(total / CONVERSATIONS_PAGE_SIZE)}
            onPageChange={(p) => {
              setPage(p);
              setSelectedId(null);
            }}
            label="Conversaciones"
          />
        }
        bodyClassName="px-2 pb-2 md:overflow-y-auto"
      >
        <ul className="space-y-0.5" aria-busy={conversations.isFetching}>
          {items.map((c) => (
            <li key={c.id}>
              <ConversationButton
                conversation={c}
                selected={c.id === active?.id}
                onSelect={() => setSelectedId(c.id)}
              />
            </li>
          ))}
        </ul>
      </Panel>
      {active && <Thread key={active.id} conversation={active} />}
    </FitPage>
  );
}

function LineBadge({ line }: { line: WhatsAppLine }) {
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      {line.phone && <span className="tabular-nums">{line.phone}</span>}
      <StatusBadge
        status={line.connected ? "wa_connected" : "wa_disconnected"}
        label={line.connected ? "Conectado" : "Desconectado"}
        tone={line.connected ? "success" : "neutral"}
      />
    </span>
  );
}

function OneLineState({ text }: { text: string }) {
  return (
    <div className="flex max-w-xl items-center gap-3 rounded-app-lg border border-border-subtle bg-surface px-5 py-4 shadow-app-xs">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-brand-soft text-brand-1">
        <MessageCircle aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ConversationButton({
  conversation: c,
  selected,
  onSelect,
}: {
  conversation: WhatsAppConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full rounded-app-md px-3 py-2 text-left transition-colors hover:bg-surface-2",
        selected && "bg-brand-soft hover:bg-brand-soft",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {c.name}
        </span>
        {c.isLead && (
          <Star aria-label="Lead" className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />
        )}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {c.lastMessageAt ? formatChatTime(c.lastMessageAt) : ""}
        </span>
      </span>
      <span className="mt-0.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {messageText(c.preview)}
        </span>
        {c.unread > 0 && (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-1 px-1 text-[10px] font-semibold text-white tabular-nums">
            {c.unread}
          </span>
        )}
      </span>
    </button>
  );
}

function Thread({ conversation }: { conversation: WhatsAppConversation }) {
  const self = useActiveClientSelf();
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = useInfiniteQuery({
    queryKey: ["client-panel", self.id, "whatsapp", "messages", conversation.id],
    queryFn: ({ pageParam }) => fetchWhatsAppMessages(conversation.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.length === MESSAGES_PAGE_SIZE ? (last[last.length - 1]?.sentAt ?? null) : null,
    staleTime: 30_000,
  });
  const firstLoaded = messages.isSuccess;

  useEffect(() => {
    if (firstLoaded) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [firstLoaded]);

  // Páginas: más nuevos primero → se muestran del más antiguo al más nuevo.
  const ordered = (messages.data?.pages ?? []).flat().reverse();

  return (
    <section className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-app-lg border border-border-subtle bg-surface shadow-app-xs md:min-h-0">
      <header className="flex shrink-0 items-center gap-3 border-b border-border-subtle px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{conversation.name}</h2>
          {conversation.phone && (
            <p className="text-xs text-muted-foreground tabular-nums">+{conversation.phone}</p>
          )}
        </div>
        {conversation.isLead && <StatusBadge status="wa_lead" label="Lead" tone="warning" />}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40 px-5 py-4">
        {messages.isPending ? (
          <ListSkeleton rows={4} label="Cargando mensajes…" />
        ) : messages.isError ? (
          <ErrorState
            message={messages.error.message}
            onRetry={() => void messages.refetch()}
            retrying={messages.isFetching}
          />
        ) : ordered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin mensajes.</p>
        ) : (
          <ol className="space-y-2">
            {messages.hasNextPage && (
              <li className="flex justify-center pb-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={messages.isFetchingNextPage}
                  onClick={() => void messages.fetchNextPage()}
                >
                  {messages.isFetchingNextPage ? "Cargando…" : "Ver mensajes anteriores"}
                </Button>
              </li>
            )}
            {ordered.map((m, i) => (
              <MessageItem key={m.id} message={m} previous={ordered[i - 1]} />
            ))}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="shrink-0 border-t border-border-subtle px-5 py-3">
        <div className="flex items-center gap-2">
          <textarea
            disabled
            rows={1}
            aria-label="Responder (disponible pronto)"
            placeholder="Pronto podrás responder desde aquí"
            className="min-h-9 flex-1 resize-none rounded-app-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <Button size="icon" disabled aria-label="Enviar (disponible pronto)">
            <SendHorizontal aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </section>
  );
}

function MessageItem({
  message: m,
  previous,
}: {
  message: WhatsAppMessage;
  previous: WhatsAppMessage | undefined;
}) {
  const day = m.sentAt ? chileDateKey(m.sentAt) : "";
  const showDay = Boolean(day) && (!previous?.sentAt || chileDateKey(previous.sentAt) !== day);
  return (
    <li>
      {showDay && m.sentAt && (
        <p className="py-2 text-center text-xs text-muted-foreground">{formatDay(m.sentAt)}</p>
      )}
      <div className={cn("flex", m.outbound ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-app-xs",
            m.outbound
              ? "rounded-br-sm bg-brand-soft text-foreground"
              : "rounded-bl-sm border border-border-subtle bg-surface text-foreground",
          )}
        >
          <p
            className={cn(
              "whitespace-pre-wrap break-words",
              !m.body && "italic text-muted-foreground",
            )}
          >
            {messageText(m.body, m.type)}
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground tabular-nums">
            {m.outbound && m.fromBot && (
              <span className="mr-1 inline-flex items-center gap-0.5">
                <Bot aria-hidden className="h-3 w-3" /> Bot
              </span>
            )}
            {m.sentAt && <time dateTime={m.sentAt}>{formatTime(m.sentAt)}</time>}
            {m.outbound && <DeliveryIcon status={m.status} />}
          </p>
        </div>
      </div>
    </li>
  );
}

function DeliveryIcon({ status }: { status: string | null }) {
  if (status === "failed") {
    return <CircleAlert aria-label="No enviado" className="h-3 w-3 text-danger-strong" />;
  }
  if (status === "read") return <CheckCheck aria-label="Leído" className="h-3 w-3 text-info" />;
  if (status === "delivered") return <CheckCheck aria-label="Entregado" className="h-3 w-3" />;
  return <Check aria-label="Enviado" className="h-3 w-3" />;
}
