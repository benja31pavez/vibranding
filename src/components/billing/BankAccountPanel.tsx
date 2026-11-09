import { useMemo, useState } from "react";
import { Copy, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyText } from "@/lib/billing/clientContact";
import {
  CHILEAN_ACCOUNT_TYPES,
  CHILEAN_BANKS,
  type ChileanAccountType,
  type ChileanBank,
} from "@/lib/finance/banks";
import { formatRut, isValidRut } from "@/lib/rut";

const SELECT_CLS =
  "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface BankFormState {
  bank: ChileanBank | "";
  accountType: ChileanAccountType | "";
  accountNumber: string;
  holderRut: string;
  holderName: string;
  email: string;
}

const EMPTY: BankFormState = {
  bank: "",
  accountType: "",
  accountNumber: "",
  holderRut: "",
  holderName: "",
  email: "",
};

/**
 * Datos bancarios para transferencia del cliente. Formulario con la lista
 * oficial de bancos chilenos y los cuatro tipos de cuenta aceptados.
 *
 * Persistencia: la plataforma aún no tiene columna donde guardar estos
 * datos, así que el panel es útil hoy para armar el texto y copiarlo (o
 * enviarlo por correo). Cuando se habilite el campo en la base de datos se
 * agrega el guardado aquí sin tocar la UI.
 */
export function BankAccountPanel() {
  const [form, setForm] = useState<BankFormState>(EMPTY);

  const rutValid = useMemo(
    () => (form.holderRut.trim() === "" ? null : isValidRut(form.holderRut)),
    [form.holderRut],
  );
  const update = <K extends keyof BankFormState>(key: K, value: BankFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const asText = () => {
    const prettyRut = rutValid ? formatRut(form.holderRut) : form.holderRut.trim();
    const lines = [
      form.bank ? `Banco: ${form.bank}` : null,
      form.accountType ? `Tipo de cuenta: ${form.accountType}` : null,
      form.accountNumber.trim() ? `N° de cuenta: ${form.accountNumber.trim()}` : null,
      form.holderName.trim() ? `Titular: ${form.holderName.trim()}` : null,
      prettyRut ? `RUT titular: ${prettyRut}` : null,
      form.email.trim() ? `Correo: ${form.email.trim()}` : null,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const copy = async () => {
    const text = asText();
    if (!text) {
      toast.error("Completa al menos un campo para copiar.");
      return;
    }
    const ok = await copyText(text);
    toast[ok ? "success" : "error"](ok ? "Datos copiados" : "No se pudo copiar; cópialos a mano.");
  };

  const canCopy = asText().length > 0;

  return (
    <Panel
      title="Cuenta bancaria para transferencia"
      icon={Landmark}
      description="Datos que el cliente usa para recibir o enviar pagos por transferencia."
    >
      <form
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void copy();
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="bank-account-bank">Banco</Label>
          <select
            id="bank-account-bank"
            className={SELECT_CLS}
            value={form.bank}
            onChange={(e) => update("bank", e.target.value as ChileanBank | "")}
          >
            <option value="">Selecciona un banco…</option>
            {CHILEAN_BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bank-account-type">Tipo de cuenta</Label>
          <select
            id="bank-account-type"
            className={SELECT_CLS}
            value={form.accountType}
            onChange={(e) => update("accountType", e.target.value as ChileanAccountType | "")}
          >
            <option value="">Selecciona un tipo…</option>
            {CHILEAN_ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bank-account-number">N° de cuenta</Label>
          <Input
            id="bank-account-number"
            value={form.accountNumber}
            onChange={(e) => update("accountNumber", e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={30}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bank-account-holder">Nombre del titular</Label>
          <Input
            id="bank-account-holder"
            value={form.holderName}
            onChange={(e) => update("holderName", e.target.value)}
            autoComplete="name"
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bank-account-rut">RUT del titular</Label>
          <Input
            id="bank-account-rut"
            value={form.holderRut}
            onChange={(e) => update("holderRut", e.target.value)}
            placeholder="12.345.678-5"
            maxLength={20}
            aria-invalid={rutValid === false || undefined}
            aria-describedby={rutValid === false ? "bank-account-rut-err" : undefined}
          />
          {rutValid === false && (
            <p id="bank-account-rut-err" className="text-xs text-warning-strong">
              RUT inválido: revisa el dígito verificador.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="bank-account-email">Correo</Label>
          <Input
            id="bank-account-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            maxLength={254}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Aún no se guardan en la base: cópialos y pégalos donde los necesites.
          </p>
          <Button type="submit" size="sm" variant="outline" disabled={!canCopy}>
            <Copy aria-hidden className="mr-1 h-4 w-4" />
            Copiar datos
          </Button>
        </div>
      </form>
    </Panel>
  );
}
