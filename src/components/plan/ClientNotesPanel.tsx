import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NotebookPen } from "lucide-react";
import { ErrorState, ListSkeleton, Panel } from "@/components/app";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useFichaOverview, useUserKey } from "@/components/clients/ficha/fichaQueries";

const SAVE_DELAY_MS = 900;

/**
 * Notas del cliente (columna `clients.notes`): acuerdos, contexto y referencias que no
 * son tareas ni objetivos. Se guardan solas al dejar de escribir.
 */
export function ClientNotesPanel({ clientId }: { clientId: string }) {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  const overview = useFichaOverview(clientId);
  const canEdit = overview.data?.canEdit ?? false;
  const notesQ = useQuery({
    queryKey: ["client-notes", userKey, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("notes,updated_at")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { notes: data?.notes ?? "", updatedAt: data?.updated_at ?? null };
    },
  });

  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);
  const value = draft ?? notesQ.data?.notes ?? "";

  const save = async (text: string) => {
    setSaving(true);
    const { error } = await supabase.from("clients").update({ notes: text }).eq("id", clientId);
    setSaving(false);
    if (error) {
      toast.error(`No se pudieron guardar las notas: ${error.message}`);
      return;
    }
    setSavedAt(new Date());
    void queryClient.invalidateQueries({ queryKey: ["client-notes", userKey, clientId] });
  };

  useEffect(() => {
    if (draft === null) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(draft), SAVE_DELAY_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (notesQ.isLoading) return <ListSkeleton rows={3} label="Cargando notas" />;
  if (notesQ.error) {
    return (
      <ErrorState
        title="No pudimos cargar las notas"
        message={notesQ.error.message}
        onRetry={() => void notesQ.refetch()}
        retrying={notesQ.isFetching}
      />
    );
  }

  const status = saving
    ? "Guardando…"
    : savedAt
      ? `Guardado a las ${savedAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
      : canEdit
        ? "Se guarda solo al dejar de escribir"
        : "Solo lectura";

  return (
    <Panel
      fill
      title="Notas del cliente"
      icon={NotebookPen}
      description={`Acuerdos, contexto y referencias que no son tareas ni objetivos · ${status}`}
    >
      <Textarea
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        readOnly={!canEdit}
        aria-label="Notas del cliente"
        placeholder="Qué acordaron en la última reunión, referencias, qué prefiere el cliente y qué no…"
        className="min-h-[320px] flex-1 resize-y text-sm leading-relaxed md:min-h-0"
      />
    </Panel>
  );
}
