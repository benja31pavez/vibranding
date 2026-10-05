import { useEffect, useState } from "react";
import { Building2, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/app";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PERMISSION_DENIED_MSG } from "./fichaQueries";

/** "Sobre la empresa": descripción del negocio, editable. */
export function BusinessDescription({
  clientId,
  value,
  onSaved,
}: {
  clientId: string;
  value: string;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("clients")
      .update({ business_description: draft.trim() || null })
      .eq("id", clientId)
      .select("id");
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar");
      return;
    }
    if (!data || data.length === 0) {
      toast.error(PERMISSION_DENIED_MSG);
      return;
    }
    await onSaved();
    setEditing(false);
    toast.success("Descripción guardada");
  };

  const actions = !editing ? (
    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
      <Pencil aria-hidden className="mr-1 h-3.5 w-3.5" /> Editar
    </Button>
  ) : (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Cancelar"
        onClick={() => {
          setDraft(value);
          setEditing(false);
        }}
      >
        <X aria-hidden className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" onClick={save} disabled={saving}>
        <Check aria-hidden className="mr-1 h-3.5 w-3.5" /> Guardar
      </Button>
    </div>
  );

  return (
    <Panel title="Sobre la empresa" icon={Building2} actions={actions}>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="¿A qué se dedica esta empresa? Sector, propuesta de valor, productos/servicios, público objetivo…"
          rows={5}
          autoFocus
        />
      ) : value ? (
        <p className="whitespace-pre-line text-sm text-foreground/90">{value}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          Aún no has descrito a qué se dedica esta empresa. Haz clic en Editar para añadirlo.
        </p>
      )}
    </Panel>
  );
}
