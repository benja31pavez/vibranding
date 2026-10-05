import { useCallback, useEffect, useState } from "react";
import { Inbox, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app";
import { writeFailed } from "@/lib/writeCheck";
import { normalizeChileMobile } from "@/lib/site/validation";

type Submission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
};

/** Mensajes recibidos por el formulario de la landing. */
export function ContactInbox({
  clientId,
  onCount,
}: {
  clientId: string;
  onCount?: (n: number) => void;
}) {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Submission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("landing_contact_submissions")
      .select("id,name,email,phone,message,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error(`No se pudieron cargar los mensajes: ${error.message}`);
      return;
    }
    setSubs((data ?? []) as Submission[]);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onCount?.(subs.length);
  }, [subs.length, onCount]);

  const remove = async (s: Submission) => {
    const res = await supabase
      .from("landing_contact_submissions")
      .delete()
      .eq("id", s.id)
      .select("id");
    if (writeFailed(res, "No se pudo eliminar el mensaje")) return;
    setSubs((prev) => prev.filter((x) => x.id !== s.id));
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4" aria-hidden="true" />
        <h2 className="font-medium">Mensajes del formulario</h2>
        <span className="text-xs text-muted-foreground">
          {loading ? "Cargando…" : `${subs.length} en total`}
        </span>
      </div>
      {!loading && subs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Cuando alguien escriba desde la landing, el mensaje aparece aquí.
        </p>
      )}
      <ul className="space-y-2">
        {subs.map((s) => {
          const wa = normalizeChileMobile(s.phone);
          return (
            <li key={s.id} className="rounded-xl border bg-background p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString("es-CL")}
                  </p>
                  <p className="whitespace-pre-line pt-1">{s.message}</p>
                  <div className="flex flex-wrap gap-3 pt-2 text-xs">
                    <a
                      href={`mailto:${s.email}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" /> {s.email}
                    </a>
                    {s.phone && (
                      <a
                        href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {s.phone}
                      </a>
                    )}
                    {wa && (
                      <a
                        href={`https://wa.me/${wa.slice(1)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Responder por
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Eliminar mensaje de ${s.name}`}
                  onClick={() => setToDelete(s)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar este mensaje?"
        description={
          toDelete
            ? `El mensaje de ${toDelete.name} se elimina y no se puede recuperar.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
          setToDelete(null);
        }}
      />
    </section>
  );
}
