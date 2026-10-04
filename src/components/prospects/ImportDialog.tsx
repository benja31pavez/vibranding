import { useRef, useState } from "react";
import { FileJson, Upload } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { parseOfficeFile, planImport, type ImportPlan } from "@/lib/prospects/importOficina";
import { STATE_META, isProspectState } from "@/lib/prospects/schema";
import { fetchExistingFor, insertProspects, useInvalidateProspects, type Prospect } from "./prospectsData";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PREVIEW_ROWS = 50;

export function ImportDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: Prospect[];
}) {
  const { user } = useAuth();
  const invalidate = useInvalidateProspects();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [checking, setChecking] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setRows(null);
    setPlan(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError("El archivo pesa más de 2 MB.");
      return;
    }
    try {
      const parsed = parseOfficeFile(await file.text());
      setRows(parsed);
      await buildPlan(parsed);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  };

  /** Plan contra la BD: busca coincidencias por correo y nombre de las filas del archivo. */
  const buildPlan = async (source: unknown[]) => {
    setChecking(true);
    setPlan(null);
    try {
      const firstPass = planImport(source, existing);
      const fromDb = await fetchExistingFor(firstPass.toInsert.map((c) => c.values));
      setPlan(planImport(source, [...existing, ...fromDb]));
    } finally {
      setChecking(false);
    }
  };

  const confirm = async () => {
    if (!plan || plan.toInsert.length === 0) return;
    setBusy(true);
    try {
      const { inserted, error } = await insertProspects(plan.toInsert.map((c) => c.values), user?.id ?? null);
      if (error) {
        toast.error(
          inserted > 0
            ? `Se importaron ${inserted} de ${plan.toInsert.length}; el resto falló: ${error}. Revisa la vista previa actualizada antes de reintentar.`
            : `No se importó ningún prospecto: ${error}`,
        );
        // Recalcular contra la BD: las filas ya insertadas pasan a "duplicado" y no se reintentan.
        if (inserted > 0 && rows) {
          try {
            await buildPlan(rows);
          } catch (err) {
            setPlan(null);
            setFileError(err instanceof Error ? err.message : "No se pudo recalcular la importación; vuelve a cargar el archivo.");
          }
        }
      } else {
        toast.success(`Se importaron ${inserted} prospectos${plan.skipped.length ? ` (${plan.skipped.length} omitidos)` : ""}.`);
        onOpenChange(false);
        reset();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setBusy(false);
      void invalidate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar desde la oficina de agentes</DialogTitle>
          <DialogDescription>
            Sube <code>data/ventas/prospectos.json</code>. Se omiten duplicados (mismo nombre y comuna, o mismo correo)
            y filas sin fuente del contacto.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-app-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground hover:bg-surface-2 focus-within:ring-2 focus-within:ring-ring">
          <FileJson aria-hidden className="h-6 w-6" />
          <span>Elegir archivo JSON</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>

        {fileError && <p role="alert" className="text-sm text-danger-strong">{fileError}</p>}

        {checking && <p role="status" className="text-sm text-muted-foreground">Revisando duplicados…</p>}
        {plan && <ImportPreview plan={plan} />}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={!plan || plan.toInsert.length === 0 || busy || checking}>
            <Upload aria-hidden className="mr-1 h-4 w-4" />
            {busy ? "Importando…" : `Importar ${plan?.toInsert.length ?? 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportPreview({ plan }: { plan: ImportPlan }) {
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-sm">
        <strong>{plan.total}</strong> filas en el archivo · <strong>{plan.toInsert.length}</strong> por importar ·{" "}
        <strong>{plan.skipped.length}</strong> omitidas
      </p>

      {plan.toInsert.length > 0 && (
        <div className="overflow-x-auto rounded-app-md border border-border-subtle">
          <table className="w-full text-sm">
            <caption className="sr-only">Prospectos que se importarán</caption>
            <thead className="bg-surface-2 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Negocio</th>
                <th scope="col" className="px-3 py-2 font-medium">Comuna</th>
                <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 font-medium">Fuente</th>
              </tr>
            </thead>
            <tbody>
              {plan.toInsert.slice(0, PREVIEW_ROWS).map(({ values, officeId }, i) => (
                <tr key={officeId ?? i} className="border-t border-border-subtle">
                  <td className="px-3 py-1.5">{values.nombre}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{values.comuna ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    {isProspectState(values.estado) && (
                      <StatusBadge status={values.estado} label={STATE_META[values.estado].label} tone={STATE_META[values.estado].tone} />
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-1.5 text-muted-foreground" title={values.fuente}>{values.fuente}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.toInsert.length > PREVIEW_ROWS && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Y {plan.toInsert.length - PREVIEW_ROWS} más…</p>
          )}
        </div>
      )}

      {plan.skipped.length > 0 && (
        <div className="rounded-app-md border border-warning/40 bg-warning-subtle p-3">
          <h3 className="text-sm font-semibold text-warning-strong">Omitidos</h3>
          <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-warning-strong">
            {plan.skipped.map((s) => (
              <li key={s.index}>
                <span className="font-medium">{s.label}</span>: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
