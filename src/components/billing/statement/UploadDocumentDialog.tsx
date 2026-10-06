import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PAYMENT_DOCUMENT_ERRORS,
  PAYMENT_DOCUMENT_KINDS,
  PAYMENT_DOCUMENT_LABEL,
  PAYMENT_DOCUMENT_MAX_BYTES,
  PAYMENT_DOCUMENT_MIME,
  isPaymentDocumentKind,
  type PaymentDocumentKind,
} from "@/lib/billing/paymentDocuments";
import { uploadPaymentDocument } from "@/lib/billing/paymentDocuments.functions";
import { errorMessage } from "./paymentWrites";
import type { StatementPayment } from "./statementData";

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No pudimos leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function validateFile(file: File | null): string | null {
  if (!file) return "Elige el PDF.";
  if (file.size === 0) return PAYMENT_DOCUMENT_ERRORS.empty;
  if (file.type !== PAYMENT_DOCUMENT_MIME) return PAYMENT_DOCUMENT_ERRORS.badType;
  if (file.size > PAYMENT_DOCUMENT_MAX_BYTES) return PAYMENT_DOCUMENT_ERRORS.tooBig;
  return null;
}

/** "Subir boleta/factura": PDF de hasta 10 MB; reemplaza el anterior si existía. */
export function UploadDocumentDialog({
  payment,
  onClose,
  onUploaded,
}: {
  payment: StatementPayment | null;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const upload = useServerFn(uploadPaymentDocument);
  const [kind, setKind] = useState<PaymentDocumentKind>("boleta");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setFile(null);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    const invalid = validateFile(file);
    if (invalid || !file) return toast.error(invalid ?? "Elige el PDF.");
    setBusy(true);
    try {
      const dataBase64 = await readBase64(file);
      await upload({ data: { paymentId: payment.id, kind, dataBase64 } });
      toast.success(`${PAYMENT_DOCUMENT_LABEL[kind]} subida`);
      setFile(null);
      onUploaded();
      onClose();
    } catch (err) {
      console.error("[facturación] error al subir documento", err);
      toast.error(errorMessage(err, "No pudimos subir el PDF"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={payment !== null} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Subir boleta o factura</DialogTitle>
            <DialogDescription>
              {payment?.document_path
                ? "Reemplaza el documento actual de este cobro. PDF de hasta 10 MB."
                : "PDF de hasta 10 MB. El cliente lo podrá descargar desde Facturación."}
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={kind}
            onValueChange={(v) => isPaymentDocumentKind(v) && setKind(v)}
            className="flex gap-4"
            aria-label="Tipo de documento"
          >
            {PAYMENT_DOCUMENT_KINDS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <RadioGroupItem id={`doc-${k}`} value={k} />
                <Label htmlFor={`doc-${k}`}>{PAYMENT_DOCUMENT_LABEL[k]}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="space-y-1.5">
            <Label htmlFor="doc-file" className="text-xs text-muted-foreground">
              Archivo PDF
            </Label>
            <Input
              id="doc-file"
              type="file"
              accept={PAYMENT_DOCUMENT_MIME}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !file}>
              {busy && <Loader2 aria-hidden className="mr-1 h-4 w-4 animate-spin" />}
              {busy ? "Subiendo…" : "Subir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
