import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Instagram } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { syncInstagramAccount } from "@/lib/meta/igSync.functions";

export function InstagramSyncCard({
  clientId,
  syncedAt,
  onSynced,
}: {
  clientId: string;
  syncedAt: string | null;
  onSynced: () => void;
}) {
  const sync = useServerFn(syncInstagramAccount);
  const [busy, setBusy] = useState(false);
  const [confirmCount, setConfirmCount] = useState<number | null>(null);

  const doSync = async () => {
    setBusy(true);
    try {
      const res = await sync({ data: { clientId } });
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      if (res.warning) {
        toast.warning(res.warning);
      } else {
        toast.success(
          `Sincronizadas ${res.mediaCount} publicaciones reales${
            res.archivedManual > 0
              ? ` · ${res.archivedManual} posts manuales archivados`
              : ""
          }`,
        );
      }
      onSynced();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo sincronizar con Instagram");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    // First sync for this client: warn about the manual posts that get archived.
    if (syncedAt) {
      void doSync();
      return;
    }
    const { count } = await supabase
      .from("instagram_posts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("type", "current")
      .is("ig_media_id", null)
      .is("archived_at", null);
    setConfirmCount(count ?? 0);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Instagram className="w-4 h-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Datos reales de Instagram</p>
          <p className="text-xs text-muted-foreground">
            {syncedAt
              ? `Última sincronización: ${new Date(syncedAt).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Sin sincronizar todavía"}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={start} disabled={busy}>
        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Sincronizando…" : "Sincronizar"}
      </Button>

      <AlertDialog
        open={confirmCount !== null}
        onOpenChange={(o) => !o && setConfirmCount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Primera sincronización</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCount && confirmCount > 0
                ? `Se reemplazará la grilla "Actual" con las publicaciones reales de Instagram. ${confirmCount} ${
                    confirmCount === 1
                      ? "publicación subida manualmente será archivada"
                      : "publicaciones subidas manualmente serán archivadas"
                  } (no se eliminan, se pueden recuperar). Tu vista "Propuesta" no se toca.`
                : 'Se traerán las publicaciones reales de Instagram a la grilla "Actual". Tu vista "Propuesta" no se toca.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCount(null);
                void doSync();
              }}
            >
              Sincronizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
