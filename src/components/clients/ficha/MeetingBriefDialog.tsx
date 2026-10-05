import { useMemo, useState } from "react";
import { ClipboardList, Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClientHealth } from "@/components/clients/health/healthQueries";
import { chileToday } from "@/lib/dates/chile";
import {
  briefToPrintHtml,
  briefToText,
  buildMeetingBrief,
  type BriefHealthInput,
  type MeetingBrief,
} from "@/lib/briefing/meetingBrief";
import type { FichaOverview } from "./fichaQueries";
import { useMeetingBriefData } from "./meetingBriefQueries";

interface MeetingBriefButtonProps {
  clientId: string;
  clientName: string;
  overview: FichaOverview | undefined;
}

/** Botón "Resumen para reunión" + diálogo con el brief de los últimos 30 días. */
export function MeetingBriefButton({ clientId, clientName, overview }: MeetingBriefButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ClipboardList aria-hidden className="mr-1.5 h-4 w-4" /> Resumen para reunión
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {open && (
            <MeetingBriefContent clientId={clientId} clientName={clientName} overview={overview} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** El formulario de onboarding solo se exige si el cliente está en onboarding o tiene link emitido. */
function intakeApplies(overview: FichaOverview | undefined): boolean {
  if (!overview) return false;
  return overview.status === "onboarding" || Boolean(overview.billing?.onboarding_token);
}

function MeetingBriefContent({ clientId, clientName, overview }: MeetingBriefButtonProps) {
  const [today] = useState(() => chileToday());
  const data = useMeetingBriefData(clientId, today, true);
  const healthQuery = useClientHealth(clientId);
  const healthPending = healthQuery.isPending && !healthQuery.isError;
  const healthError = healthQuery.isError;

  const healthData = healthQuery.health;
  const brief = useMemo<MeetingBrief | null>(() => {
    if (!data.data || healthPending) return null;
    const health: BriefHealthInput | null = healthData
      ? { level: healthData.level, reasons: healthData.reasons }
      : null;
    return buildMeetingBrief({
      ...data.data,
      intakeSubmitted: intakeApplies(overview) ? data.data.intakeSubmitted : null,
      clientName,
      today,
      health,
      healthError,
    });
  }, [data.data, healthData, healthPending, healthError, overview, clientName, today]);

  const copy = async () => {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(briefToText(brief));
      toast.success("Resumen copiado");
    } catch (e) {
      console.error("[resumen] no se pudo copiar", e);
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  const print = () => {
    if (!brief) return;
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) {
      toast.error(
        "El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e intenta de nuevo.",
      );
      return;
    }
    win.document.open();
    win.document.write(briefToPrintHtml(brief));
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Resumen para reunión</DialogTitle>
        <DialogDescription>
          {brief?.periodLabel ?? "Últimos 30 días."} Armado solo con datos registrados en la
          plataforma.
        </DialogDescription>
      </DialogHeader>

      {data.isError ? (
        <ErrorState
          message={data.error.message}
          onRetry={() => void data.refetch()}
          retrying={data.isFetching}
        />
      ) : !brief ? (
        <ListSkeleton rows={6} label="Armando el resumen" />
      ) : (
        <div className="space-y-4">
          {brief.sections.map((s) => (
            <section key={s.key} aria-labelledby={`brief-${s.key}`}>
              <h3 id={`brief-${s.key}`} className="mb-1 text-sm font-semibold">
                {s.title}
              </h3>
              <ul className="space-y-0.5 text-sm text-foreground">
                {s.lines.map((line, i) => (
                  <li
                    key={i}
                    className={line.startsWith("  ") ? "pl-4 text-muted-foreground" : undefined}
                  >
                    {line.trim()}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={print} disabled={!brief}>
          <Printer aria-hidden className="mr-1.5 h-4 w-4" /> Imprimir
        </Button>
        <Button onClick={() => void copy()} disabled={!brief}>
          <Copy aria-hidden className="mr-1.5 h-4 w-4" /> Copiar resumen
        </Button>
      </DialogFooter>
    </>
  );
}
