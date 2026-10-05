import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Kind = "keyword" | "welcome";

type DmTrigger = {
  id: string;
  client_id: string;
  kind: Kind;
  name: string;
  keywords: string[];
  match_type: "keyword" | "exact" | "starts_with" | "any";
  message: string;
  is_active: boolean;
  triggered_count: number;
  sent_count: number;
  failed_count: number;
  last_triggered_at: string | null;
};

const MATCH_LABEL: Record<DmTrigger["match_type"], string> = {
  keyword: "Contiene la palabra",
  exact: "Coincidencia exacta",
  starts_with: "Empieza con",
  any: "Cualquier mensaje",
};

export function DmTriggersPanel({ clientId, kind }: { clientId: string; kind: Kind }) {
  const [rows, setRows] = useState<DmTrigger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.from("ig_dm_triggers" as any) as any)
        .select("*")
        .eq("client_id", clientId)
        .eq("kind", kind)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setRows((data ?? []) as DmTrigger[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, kind]);

  const add = async () => {
    const { data, error } = await (supabase.from("ig_dm_triggers" as any) as any)
      .insert({
        client_id: clientId,
        kind,
        name: kind === "welcome" ? "Mensaje de bienvenida" : "Nueva palabra clave",
        keywords: kind === "welcome" ? [] : ["precio"],
        match_type: kind === "welcome" ? "any" : "keyword",
        message:
          kind === "welcome"
            ? "¡Hola! Gracias por escribirnos 🙌 Cuéntanos qué necesitas y te ayudamos al instante."
            : "¡Hola! Te comparto la información que pediste 👇",
        is_active: false,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setRows([data as DmTrigger, ...rows]);
  };

  const patch = (id: string, p: Partial<DmTrigger>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const persist = async (t: DmTrigger) => {
    const { error } = await (supabase.from("ig_dm_triggers" as any) as any)
      .update({
        name: t.name,
        keywords: t.keywords,
        match_type: t.match_type,
        message: t.message,
        is_active: t.is_active,
      })
      .eq("id", t.id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from("ig_dm_triggers" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(rows.filter((r) => r.id !== id));
  };

  const welcomeActive = rows.filter((r) => r.is_active).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          {kind === "keyword"
            ? "Cuando alguien te escribe un mensaje directo con una palabra clave, el sistema responde automáticamente dentro de la ventana de 24 horas que abre ese mensaje."
            : "Se envía la primera vez que una persona abre una conversación por mensaje directo. Es el saludo automático que sí permite Meta."}
        </p>
        <Button size="sm" onClick={add} disabled={kind === "welcome" && rows.length > 0}>
          <Plus className="w-4 h-4 mr-1" />
          {kind === "welcome" ? "Crear bienvenida" : "Nueva palabra clave"}
        </Button>
      </div>

      {kind === "welcome" && welcomeActive > 1 && (
        <p className="text-xs text-destructive">
          Hay más de una bienvenida activa: solo se usará la de mayor prioridad.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {kind === "welcome"
            ? "Aún no hay mensaje de bienvenida configurado."
            : "Aún no hay palabras clave para mensajes directos."}
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((t) => (
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

              {kind === "keyword" && (
                <div className="grid md:grid-cols-2 gap-3">
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
                      placeholder="precio, info, horario"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Coincidencia</Label>
                    <select
                      className="block w-full h-9 rounded-md border bg-background px-2 text-sm"
                      value={t.match_type}
                      onChange={(e) => {
                        const v = e.target.value as DmTrigger["match_type"];
                        patch(t.id, { match_type: v });
                        persist({ ...t, match_type: v });
                      }}
                    >
                      {(Object.keys(MATCH_LABEL) as DmTrigger["match_type"][]).map((k) => (
                        <option key={k} value={k}>
                          {MATCH_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Respuesta automática</Label>
                <Textarea
                  value={t.message}
                  onChange={(e) => patch(t.id, { message: e.target.value })}
                  onBlur={() => persist(t)}
                  rows={3}
                  maxLength={900}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{t.sent_count} enviados</Badge>
                {t.failed_count > 0 && (
                  <Badge variant="destructive">{t.failed_count} fallidos</Badge>
                )}
                {t.last_triggered_at && (
                  <span>Último: {t.last_triggered_at.slice(0, 16).replace("T", " ")}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
