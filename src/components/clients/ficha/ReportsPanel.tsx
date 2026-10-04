import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Eye, FileBarChart, Pencil, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState, ListSkeleton, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ReportView } from "@/components/reports/ReportView";
import { publicReportUrl, reportKeys, useClientReports, type MonthlyReportRow } from "@/components/reports/reportQueries";
import { generateMonthlyReportNow } from "@/lib/reports/monthly.functions";
import { periodLabel } from "@/lib/billing/dates";
import { defaultReportPeriod } from "@/lib/reports/period";
import { formatDate, useUserKey, writeErrorMessage } from "./fichaQueries";

interface ReportsPanelProps {
  clientId: string;
  clientName: string;
  canEdit: boolean;
}

/** Reportes mensuales del cliente: generar, editar resumen, copiar link y marcar enviado. */
export function ReportsPanel({ clientId, clientName, canEdit }: ReportsPanelProps) {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  const reports = useClientReports(userKey, clientId);
  const generate = useServerFn(generateMonthlyReportNow);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<MonthlyReportRow | null>(null);
  const [preview, setPreview] = useState<MonthlyReportRow | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);
  const period = defaultReportPeriod();
  const alreadySent = Boolean(reports.data?.find((r) => r.period === period)?.sent_at);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["monthly-reports", userKey] });

  const onGenerate = async (force = false) => {
    setGenerating(true);
    try {
      const res = await generate({ data: { clientId, period, force } });
      toast.success(`Reporte de ${periodLabel(res.period)} ${res.created ? "generado" : "actualizado"}`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message || "No se pudo generar el reporte");
    } finally {
      setGenerating(false);
    }
  };

  const actions = canEdit ? (
    <Button
      size="sm"
      variant="outline"
      onClick={() => (alreadySent ? setConfirmForce(true) : void onGenerate())}
      disabled={generating}
    >
      <RefreshCw aria-hidden className={`mr-1.5 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
      Generar ahora
    </Button>
  ) : null;

  return (
    <Panel
      title="Reportes"
      icon={FileBarChart}
      description="Se generan solos el día 1 de cada mes con los resultados del mes anterior."
      actions={actions}
    >
      {reports.isLoading ? (
        <ListSkeleton rows={3} label="Cargando reportes" />
      ) : reports.error ? (
        <ErrorState message={reports.error.message} onRetry={() => void reports.refetch()} retrying={reports.isFetching} />
      ) : !reports.data?.length ? (
        <EmptyState
          icon={FileBarChart}
          title="Aún no hay reportes"
          description={canEdit ? "Usa «Generar ahora» para crear el del mes pasado." : "El primero se generará el día 1."}
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {reports.data.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              canEdit={canEdit}
              onEdit={() => setEditing(r)}
              onPreview={() => setPreview(r)}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}

      <AlertDialog open={confirmForce} onOpenChange={setConfirmForce}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar el reporte de {periodLabel(period)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Este reporte ya fue enviado; regenerarlo cambiará lo que ve el cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onGenerate(true)}>Regenerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SummaryDialog report={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
            <DialogDescription>Así lo verá el cliente al abrir el link.</DialogDescription>
          </DialogHeader>
          {preview?.data && (
            <ReportView clientName={clientName} period={preview.period} data={preview.data} summary={preview.summary} />
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

interface ReportRowProps {
  report: MonthlyReportRow;
  canEdit: boolean;
  onEdit: () => void;
  onPreview: () => void;
  onChanged: () => Promise<void>;
}

function ReportRow({ report, canEdit, onEdit, onPreview, onChanged }: ReportRowProps) {
  const [busy, setBusy] = useState(false);
  const sent = Boolean(report.sent_at);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicReportUrl(report.token));
      toast.success(sent ? "Link copiado" : "Link copiado. Se activa cuando marques el reporte como enviado.");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  };

  const markSent = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("monthly_reports")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", report.id)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      toast.error(error ? writeErrorMessage(error) : "No tienes permisos para editar este cliente.");
      return;
    }
    toast.success("Reporte marcado como enviado; el link ya está activo");
    await onChanged();
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium capitalize">{periodLabel(report.period)}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={sent ? "sent" : "draft"} />
          <span>{sent ? `Enviado el ${formatDate(report.sent_at)}` : `Actualizado el ${formatDate(report.updated_at)}`}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" onClick={onPreview} disabled={!report.data} aria-label="Vista previa">
          <Eye aria-hidden className="h-4 w-4" />
        </Button>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Editar resumen">
            <Pencil aria-hidden className="h-4 w-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={copy} aria-label="Copiar link">
          <Copy aria-hidden className="mr-1 h-4 w-4" /> Link
        </Button>
        {canEdit && !sent && (
          <Button size="sm" onClick={markSent} disabled={busy}>
            <Send aria-hidden className="mr-1 h-4 w-4" /> Marcar enviado
          </Button>
        )}
      </div>
    </li>
  );
}

function SummaryDialog({
  report,
  onClose,
  onSaved,
}: {
  report: MonthlyReportRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const auto = report?.data?.auto_summary ?? "";

  useEffect(() => {
    setDraft(report?.summary ?? auto);
  }, [report, auto]);

  const save = async () => {
    if (!report) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("monthly_reports")
      .update({ summary: draft.trim() || null })
      .eq("id", report.id)
      .select("id");
    setSaving(false);
    if (error || !data?.length) {
      toast.error(error ? writeErrorMessage(error) : "No tienes permisos para editar este cliente.");
      return;
    }
    toast.success("Resumen guardado");
    await onSaved();
    onClose();
  };

  return (
    <Dialog open={report !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resumen de {report ? periodLabel(report.period) : ""}</DialogTitle>
          <DialogDescription>
            Una conclusión por línea, en lenguaje simple. Es lo primero que lee el cliente.
          </DialogDescription>
        </DialogHeader>
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={7} maxLength={2000} />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setDraft(auto)} disabled={!auto || draft === auto}>
            Usar resumen automático
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
