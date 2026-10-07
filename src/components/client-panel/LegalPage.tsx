import { useRef, useState, type Ref } from "react";
import { Download, Eye, FileText, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { FitList, FitPage, PageHeader, Panel, StatusBadge } from "@/components/app";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { NET_PLUS_IVA_BASIS } from "@/components/contracts/contractModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONTRACT_STATUS_LABEL,
  contractFileName,
  contractServicesLabel,
  type PanelContract,
} from "@/lib/client-panel/model";
import { exportElementToPdf } from "@/lib/exportPdf";
import { PanelSectionState } from "./PanelSectionState";
import { usePanelContracts } from "./usePanelData";

const MOBILE_LIST_PAGE = 8;
/** Tiempo para que el documento oculto termine de pintarse antes de capturarlo. */
const RENDER_WAIT_MS = 80;

const DATE = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Santiago",
});

function formatDay(value: string | null): string {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "" : DATE.format(date).replace(".", "");
}

function dateLine(c: PanelContract): string {
  if (c.status === "signed" && c.signed_at) return `Firmado el ${formatDay(c.signed_at)}`;
  const day = formatDay(c.effective_date ?? c.created_at);
  return day ? `Enviado el ${day}` : "";
}

/** El documento del contrato con los datos guardados (los mismos del PDF que firma el cliente). */
function ContractDoc({
  contract: c,
  docRef,
}: {
  contract: PanelContract;
  docRef?: Ref<HTMLDivElement>;
}) {
  return (
    <ContractDocument
      ref={docRef}
      title={c.title}
      effective_date={c.effective_date ?? ""}
      payment_due_days={c.payment_due_days}
      jurisdiction={c.agency.jurisdiction ?? ""}
      governingLaw={c.agency.governing_law ?? ""}
      vatIncluded={c.agency.vat_included === true}
      netPlusIva={c.agency.price_basis === NET_PLUS_IVA_BASIS}
      agency={{
        name: c.agency.name ?? "",
        legal_name: c.agency.legal_name ?? "",
        tax_id: c.agency.tax_id ?? "",
        address: c.agency.address ?? "",
        email: c.agency.email ?? "",
      }}
      client={{
        name: c.client.name ?? "",
        handle: c.client.handle ?? "",
        legal_name: c.client.legal_name ?? "",
        tax_id: c.client.tax_id ?? "",
        address: c.client.address ?? "",
        email: c.client.email ?? "",
      }}
      services={c.services}
      clauses={c.clauses}
      totals={{ one_time: c.total_one_time, monthly: c.total_monthly }}
    />
  );
}

/**
 * Legal del cliente en solo lectura: contratos enviados o firmados (nunca
 * borradores), con su estado. Ver el contrato y descargarlo en PDF (se genera
 * en el navegador con los datos de SU contrato, que entrega el servidor).
 */
export function LegalPage() {
  const query = usePanelContracts();
  return (
    <FitPage header={<PageHeader size="compact" title="Legal" />} contentClassName="flex flex-col">
      <PanelSectionState query={query} title="No pudimos cargar tus contratos">
        {(contracts) => <ContractList contracts={contracts} />}
      </PanelSectionState>
    </FitPage>
  );
}

function ContractList({ contracts }: { contracts: readonly PanelContract[] }) {
  const [viewing, setViewing] = useState<PanelContract | null>(null);
  const [printing, setPrinting] = useState<PanelContract | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const download = async (c: PanelContract) => {
    setPrinting(c);
    await new Promise((r) => setTimeout(r, RENDER_WAIT_MS));
    try {
      if (!pdfRef.current) throw new Error("No se pudo preparar el contrato para el PDF");
      await exportElementToPdf(pdfRef.current, contractFileName(c));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "No se pudo generar el PDF");
    } finally {
      setPrinting(null);
    }
  };

  return (
    <Panel
      title="Contratos"
      icon={Scale}
      className="md:max-h-full md:min-h-0"
      bodyClassName="md:overflow-y-auto"
    >
      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no tienes contratos.</p>
      ) : (
        <FitList
          items={contracts}
          getKey={(c) => c.id}
          label="Contratos"
          divided
          defaultPageSize={MOBILE_LIST_PAGE}
          renderItem={(c) => (
            <div className="flex min-w-0 flex-wrap items-center gap-3 px-1 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-brand-soft text-brand-1">
                <FileText aria-hidden className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[contractServicesLabel(c.services), dateLine(c)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <StatusBadge
                status={c.status}
                label={CONTRACT_STATUS_LABEL[c.status]}
                tone={c.status === "signed" ? "success" : "info"}
              />
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setViewing(c)}>
                  <Eye aria-hidden className="mr-1.5 h-4 w-4" /> Ver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={printing !== null}
                  onClick={() => void download(c)}
                  aria-label={`Descargar ${c.title} en PDF`}
                >
                  {printing?.id === c.id ? (
                    <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download aria-hidden className="mr-1.5 h-4 w-4" />
                  )}
                  PDF
                </Button>
              </div>
            </div>
          )}
        />
      )}

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-[880px] gap-3">
          {viewing && (
            <>
              <DialogHeader className="space-y-1 pr-8 text-left">
                <DialogTitle className="truncate">{viewing.title}</DialogTitle>
                <DialogDescription>
                  {CONTRACT_STATUS_LABEL[viewing.status]}
                  {dateLine(viewing) ? ` · ${dateLine(viewing)}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-auto rounded-app-md border bg-white">
                <ContractDoc contract={viewing} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {printing && (
        <div aria-hidden style={{ position: "fixed", left: -10000, top: 0 }}>
          <ContractDoc contract={printing} docRef={pdfRef} />
        </div>
      )}
    </Panel>
  );
}
