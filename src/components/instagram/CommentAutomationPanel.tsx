import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { subscribeIgWebhook } from "@/lib/instagram/webhook.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageSquare,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  Zap,
  Loader2,
} from "lucide-react";

type Trigger = {
  id: string;
  client_id: string;
  ig_media_id: string | null;
  name: string;
  keywords: string[];
  match_type: "keyword" | "exact" | "starts_with" | "any";
  dm_message: string;
  public_reply: string | null;
  is_active: boolean;
  triggered_count: number;
  sent_count: number;
  failed_count: number;
  last_triggered_at: string | null;
};

type Media = {
  id: string;
  ig_media_id: string;
  caption: string | null;
  cover_url: string | null;
  image_url: string | null;
  published_at: string | null;
};

type EventRow = {
  id: string;
  commenter_username: string | null;
  comment_text: string | null;
  matched: boolean;
  dm_status: string;
  dm_error: string | null;
  reply_status: string;
  created_at: string;
};

const MATCH_LABEL: Record<Trigger["match_type"], string> = {
  keyword: "Contiene la palabra",
  exact: "Coincidencia exacta",
  starts_with: "Empieza con",
  any: "Cualquier comentario",
};

export function CommentAutomationPanel({ clientId }: { clientId: string }) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const subscribe = useServerFn(subscribeIgWebhook);

  const load = async () => {
    setLoading(true);
    const [t, m, e] = await Promise.all([
      (supabase.from("ig_comment_triggers" as any) as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("instagram_posts")
        .select("id,ig_media_id,caption,cover_url,image_url,published_at")
        .eq("client_id", clientId)
        .not("ig_media_id", "is", null)
        .is("archived_at", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(60),
      (supabase.from("ig_automation_events" as any) as any)
        .select("id,commenter_username,comment_text,matched,dm_status,dm_error,reply_status,created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    setTriggers((t.data ?? []) as Trigger[]);
    setMedia((m.data ?? []) as unknown as Media[]);
    setEvents((e.data ?? []) as EventRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const addTrigger = async () => {
    const { data, error } = await (supabase.from("ig_comment_triggers" as any) as any)
      .insert({
        client_id: clientId,
        name: "Nueva automatización",
        keywords: ["info"],
        match_type: "keyword",
        dm_message: "¡Hola! Gracias por comentar 🙌 Aquí va la información que pediste:",
        is_active: false,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setTriggers([data as Trigger, ...triggers]);
  };

  const patch = (id: string, p: Partial<Trigger>) =>
    setTriggers((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const persist = async (t: Trigger) => {
    const { error } = await (supabase.from("ig_comment_triggers" as any) as any)
      .update({
        name: t.name,
        ig_media_id: t.ig_media_id,
        keywords: t.keywords,
        match_type: t.match_type,
        dm_message: t.dm_message,
        public_reply: t.public_reply,
        is_active: t.is_active,
      })
      .eq("id", t.id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from("ig_comment_triggers" as any) as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    setTriggers(triggers.filter((t) => t.id !== id));
  };

  const onSubscribe = async () => {
    setSubscribing(true);
    try {
      const res = await subscribe({ data: { clientId } });
      if (res.ok) toast.success("Webhook de comentarios activado en Meta");
      else toast.error(res.reason);
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo activar el webhook");
    } finally {
      setSubscribing(false);
    }
  };

  const totalSent = triggers.reduce((a, t) => a + t.sent_count, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Cuando alguien comenta una palabra clave, el sistema le envía un mensaje directo
            automáticamente y, si quieres, responde el comentario en público.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalSent} mensajes directos enviados en total. Los webhooks solo llegan cuando la app
            está publicada: revísalo en Admin → Salud del sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onSubscribe} disabled={subscribing}>
            {subscribing ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-1" />
            )}
            Activar webhook
          </Button>
          <Button size="sm" onClick={addTrigger}>
            <Plus className="w-4 h-4 mr-1" /> Nueva
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : triggers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay automatizaciones. Crea una, elige la publicación y la palabra clave.
        </p>
      ) : (
        <ul className="space-y-4">
          {triggers.map((t) => {
            const post = media.find((m) => m.ig_media_id === t.ig_media_id);
            return (
              <li key={t.id} className="rounded-2xl border bg-background p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={t.name}
                    onChange={(e) => patch(t.id, { name: e.target.value })}
                    onBlur={() => persist(t)}
                    className="font-medium"
                    maxLength={80}
                  />
                  <Label className="flex items-center gap-2 text-xs whitespace-nowrap">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={(v) => {
                        patch(t.id, { is_active: v });
                        persist({ ...t, is_active: v });
                      }}
                    />
                    {t.is_active ? "Activa" : "Pausada"}
                  </Label>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Publicación</Label>
                    <select
                      className="block w-full h-9 rounded-md border bg-background px-2 text-sm"
                      value={t.ig_media_id ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        patch(t.id, { ig_media_id: v });
                        persist({ ...t, ig_media_id: v });
                      }}
                    >
                      <option value="">Todas las publicaciones</option>
                      {media.map((m) => (
                        <option key={m.ig_media_id} value={m.ig_media_id}>
                          {(m.caption ?? "Sin texto").slice(0, 60)}
                          {m.published_at ? ` · ${m.published_at.slice(0, 10)}` : ""}
                        </option>
                      ))}
                    </select>
                    {media.length === 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        No hay publicaciones sincronizadas todavía. Sincroniza Instagram arriba para
                        elegir una publicación específica.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Coincidencia</Label>
                    <select
                      className="block w-full h-9 rounded-md border bg-background px-2 text-sm"
                      value={t.match_type}
                      onChange={(e) => {
                        const v = e.target.value as Trigger["match_type"];
                        patch(t.id, { match_type: v });
                        persist({ ...t, match_type: v });
                      }}
                    >
                      {(Object.keys(MATCH_LABEL) as Trigger["match_type"][]).map((k) => (
                        <option key={k} value={k}>
                          {MATCH_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {post && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(post.cover_url || post.image_url) && (
                      <img
                        src={post.cover_url ?? post.image_url ?? ""}
                        alt=""
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    Aplicada solo a esta publicación
                  </div>
                )}

                {t.match_type !== "any" && (
                  <div>
                    <Label className="text-xs">Palabras clave (separadas por coma)</Label>
                    <Input
                      value={t.keywords.join(", ")}
                      onChange={(e) =>
                        patch(t.id, {
                          keywords: e.target.value
                            .split(",")
                            .map((k) => k.trim())
                            .filter(Boolean),
                        })
                      }
                      onBlur={() => persist(t)}
                      placeholder="info, precio, quiero"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs">Mensaje directo</Label>
                  <Textarea
                    rows={3}
                    value={t.dm_message}
                    onChange={(e) => patch(t.id, { dm_message: e.target.value })}
                    onBlur={() => persist(t)}
                    maxLength={900}
                  />
                </div>

                <div>
                  <Label className="text-xs">Respuesta pública (opcional)</Label>
                  <Input
                    value={t.public_reply ?? ""}
                    onChange={(e) => patch(t.id, { public_reply: e.target.value })}
                    onBlur={() => persist(t)}
                    placeholder="¡Te escribí por privado! 💬"
                    maxLength={300}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">
                    <MessageSquare className="w-3 h-3 mr-1" /> {t.triggered_count} activaciones
                  </Badge>
                  <Badge variant="secondary">
                    <Send className="w-3 h-3 mr-1" /> {t.sent_count} enviados
                  </Badge>
                  {t.failed_count > 0 && (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {t.failed_count} fallidos
                    </Badge>
                  )}
                  {t.last_triggered_at && (
                    <span className="text-muted-foreground">
                      Última: {new Date(t.last_triggered_at).toLocaleString("es")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-2xl border bg-surface p-4">
        <h4 className="text-sm font-medium mb-2">Últimos comentarios procesados</h4>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin registros todavía. Aparecen aquí en cuanto Meta empiece a enviar comentarios.
          </p>
        ) : (
          <ul className="text-xs space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-2 border-b py-1.5 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("es", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="font-medium">@{e.commenter_username ?? "—"}</span>
                <span className="flex-1 truncate">{e.comment_text}</span>
                <span
                  className={
                    e.dm_status === "sent"
                      ? "text-emerald-600"
                      : e.dm_status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {e.dm_status === "sent"
                    ? "DM enviado"
                    : e.dm_status === "failed"
                      ? `Error: ${e.dm_error ?? "desconocido"}`
                      : e.matched
                        ? "Sin envío"
                        : "Sin coincidencia"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
