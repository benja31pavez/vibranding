import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Instagram } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  const run = async () => {
    setBusy(true);
    try {
      const res = await sync({ data: { clientId } });
      toast.success(
        res.mediaCount > 0
          ? `Sincronizadas ${res.mediaCount} publicaciones reales`
          : "Perfil sincronizado. No se encontraron publicaciones.",
      );
      onSynced();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo sincronizar con Instagram");
    } finally {
      setBusy(false);
    }
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
      <Button size="sm" variant="outline" onClick={run} disabled={busy}>
        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Sincronizando…" : "Sincronizar"}
      </Button>
    </div>
  );
}
