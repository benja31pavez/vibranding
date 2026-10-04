import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Money } from "@/components/app";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { invalidateShellClients } from "@/components/shell/shellQueries";
import { useAuth } from "@/hooks/use-auth";
import { convertToClient, findClientsByName, suggestedPlan } from "./convertToClient";
import { useInvalidateProspects, type Prospect } from "./prospectsData";

export function ConvertDialog({ prospect, onClose }: { prospect: Prospect | null; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProspects();
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; name: string }[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    setDuplicates([]);
    setLookupError(null);
    if (!prospect) return;
    let cancelled = false;
    findClientsByName(prospect.org_id, prospect.nombre)
      .then((rows) => { if (!cancelled) setDuplicates(rows); })
      .catch((err: unknown) => {
        if (!cancelled) setLookupError(err instanceof Error ? err.message : "No se pudo revisar si ya existe el cliente.");
      });
    return () => { cancelled = true; };
  }, [prospect]);

  const plan = prospect ? suggestedPlan(prospect) : null;

  const confirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!prospect || !user) return;
    setBusy(true);
    try {
      const result = await convertToClient(prospect, user.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      result.warnings.forEach((w) => toast.warning(w, { duration: 10_000 }));
      toast.success(`${prospect.nombre} ahora es cliente`);
      void invalidate();
      void invalidateShellClients(queryClient);
      onClose();
      void navigate({ to: "/clients/$clientId", params: { clientId: result.clientId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo convertir en cliente");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={Boolean(prospect)} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convertir en cliente</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Se creará el cliente <strong>{prospect?.nombre}</strong> en etapa Onboarding y el prospecto quedará como ganado.
              </p>
              <p>
                Plan:{" "}
                {plan ? (
                  <>
                    <strong>{plan.label}</strong> · <Money amount={plan.price} />
                    {plan.billing === "monthly" ? " al mes" : " (pago único)"}
                  </>
                ) : (
                  "sin plan sugerido (lo asignas en la ficha)"
                )}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {duplicates.length > 0 && (
          <div role="alert" className="rounded-app-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-strong">
            Ya existe un cliente con este nombre:{" "}
            {duplicates.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link to="/clients/$clientId" params={{ clientId: c.id }} className="font-medium underline" onClick={onClose}>
                  {c.name}
                </Link>
              </span>
            ))}
            . Si continúas se creará otro.
          </div>
        )}
        {lookupError && <p role="alert" className="text-sm text-warning-strong">{lookupError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={busy}>
            {busy ? "Creando…" : "Crear cliente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
