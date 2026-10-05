import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw, Clock, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { isStale } from "@/hooks/use-unmarked-outcomes";
import {
  OutcomeSelector,
  type Outcome,
  type OutcomeStatus,
} from "@/components/chatbot/OutcomeSelector";

type Row = {
  id: string;
  contact_wa_id: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  is_lead: boolean;
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Compact backlog view: every conversation without an outcome, with the four
 * outcome buttons inline so a whole backlog can be cleared in one sitting.
 */
export function OutcomeBackfill({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [attributions, setAttributions] = useState<Record<string, string | null>>({});
  const [hideMarked, setHideMarked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: convs }, { data: outs }, { data: attrs }] = await Promise.all([
      supabase
        .from("whatsapp_conversations")
        .select("id,contact_wa_id,contact_name,last_message_at,last_message_preview,is_lead")
        .eq("client_id", clientId)
        .order("last_message_at", { ascending: true, nullsFirst: true }),
      (supabase.from("conversation_outcomes" as any) as any)
        .select("conversation_id,status,value_clp")
        .eq("client_id", clientId),
      (supabase.from("attributions" as any) as any)
        .select("conversation_id,headline")
        .eq("client_id", clientId),
    ]);
    const map: Record<string, Outcome> = {};
    for (const o of (outs ?? []) as Outcome[]) map[o.conversation_id] = o;
    const attrMap: Record<string, string | null> = {};
    for (const a of (attrs ?? []) as any[]) {
      if (a.conversation_id) attrMap[a.conversation_id] = a.headline ?? null;
    }
    setOutcomes(map);
    setAttributions(attrMap);
    // Only conversations that were unmarked when the view opened stay in the list,
    // so a row does not disappear the instant it is marked.
    setRows(((convs ?? []) as Row[]).filter((c) => !map[c.id]));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const setOutcome = async (
    convId: string,
    status: OutcomeStatus,
    valueClp: number | null = null,
  ) => {
    const previous = outcomes[convId] ?? null;
    setOutcomes((prev) => ({
      ...prev,
      [convId]: {
        conversation_id: convId,
        status,
        value_clp: status === "closed" ? valueClp : null,
      },
    }));
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase.from("conversation_outcomes" as any) as any).upsert(
      {
        client_id: clientId,
        conversation_id: convId,
        status,
        value_clp: status === "closed" ? valueClp : null,
        marked_by: auth.user?.id ?? null,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id" },
    );
    if (error) {
      setOutcomes((prev) => {
        const next = { ...prev };
        if (previous) next[convId] = previous;
        else delete next[convId];
        return next;
      });
      toast.error(error.message);
    }
  };

  const remaining = useMemo(() => rows.filter((r) => !outcomes[r.id]).length, [rows, outcomes]);
  const visible = hideMarked ? rows.filter((r) => !outcomes[r.id]) : rows;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Marcar resultados pendientes</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {loading
              ? "Cargando…"
              : rows.length === 0
                ? "No hay conversaciones sin marcar. "
                : `${remaining} de ${rows.length} sin marcar. Un toque guarda el resultado.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="hide-marked" checked={hideMarked} onCheckedChange={setHideMarked} />
            <Label htmlFor="hide-marked" className="text-xs">
              Ocultar marcadas
            </Label>
          </div>
          <Button size="icon" variant="ghost" onClick={load} title="Refrescar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!loading && visible.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Todo marcado. La analítica ya puede calcular calificadas, cierres y ROAS.
          </div>
        )}
        {visible.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {r.contact_name || `+${r.contact_wa_id}`}
                </span>
                {attributions[r.id] !== undefined && (
                  <span title={attributions[r.id] ?? "Desde anuncio"}>
                    <Megaphone className="h-3 w-3 text-sky-500" />
                  </span>
                )}
                {!outcomes[r.id] && isStale(r.last_message_at) && (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <Clock className="h-3 w-3" /> Sin marcar
                  </Badge>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {r.last_message_preview ?? "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">{fmt(r.last_message_at)}</div>
            </div>
            <div className="w-full md:w-[320px]">
              <OutcomeSelector
                outcome={outcomes[r.id] ?? null}
                onSelect={(status) => setOutcome(r.id, status, outcomes[r.id]?.value_clp ?? null)}
                onValue={(value) => setOutcome(r.id, "closed", value)}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
