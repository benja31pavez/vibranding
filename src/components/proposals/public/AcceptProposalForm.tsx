import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptProposal } from "@/lib/proposals/public.functions";
import type { AcceptResult } from "@/lib/proposals/public.server";
import { isValidRut } from "@/lib/proposals/rut";

const REASON_MESSAGE: Readonly<Record<string, string>> = {
  invalid: "Este link ya no es válido. Pide uno nuevo a tu contacto en Vibranding.",
  name_required: "Escribe tu nombre completo.",
  expirada: "La propuesta venció. Escríbenos y te enviamos una actualizada.",
  rechazada: "Esta propuesta fue cerrada. Escríbenos si quieres retomarla.",
  aceptada: "Esta propuesta ya fue aceptada.",
};

interface Props {
  token: string;
  onAccepted: (result: Extract<AcceptResult, { ok: true }>) => void;
}

/** Formulario de aceptación: nombre, RUT opcional (módulo 11), email opcional y checkbox. */
export function AcceptProposalForm({ token, onAccepted }: Props) {
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rutInvalid = rut.trim() !== "" && !isValidRut(rut);
  const canSubmit = name.trim().length >= 3 && accepted && !rutInvalid && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await acceptProposal({
        data: { token, name: name.trim(), rut: rut.trim(), email: email.trim(), accepted: true },
      });
      if (res.ok) {
        onAccepted(res);
        return;
      }
      setError(res.message ?? REASON_MESSAGE[res.reason] ?? "No pudimos registrar tu aceptación.");
    } catch (err) {
      console.error("[proposal] aceptar falló", err);
      setError("No pudimos registrar tu aceptación. Revisa los datos e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="accept-name">Nombre completo</Label>
        <Input
          id="accept-name"
          autoComplete="name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="accept-rut">RUT (opcional)</Label>
          <Input
            id="accept-rut"
            inputMode="text"
            placeholder="12.345.678-5"
            value={rut}
            maxLength={20}
            onChange={(e) => setRut(e.target.value)}
            aria-invalid={rutInvalid}
            aria-describedby={rutInvalid ? "accept-rut-error" : undefined}
          />
          {rutInvalid && (
            <p id="accept-rut-error" className="text-xs text-danger-strong">
              El RUT no es válido. Revisa el dígito verificador.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accept-email">Email (opcional)</Label>
          <Input
            id="accept-email"
            type="email"
            autoComplete="email"
            placeholder="para el link de pago"
            value={email}
            maxLength={200}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="accept-terms" className="text-sm font-normal leading-snug">
          Acepto las condiciones de esta propuesta.
        </Label>
      </div>
      {error && (
        <p role="alert" className="rounded-app-md bg-danger-subtle px-3 py-2 text-sm text-danger-strong">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {busy && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
        Aceptar propuesta
      </Button>
      <p className="text-xs text-muted-foreground">
        Al aceptar registramos tu nombre, la fecha y un identificador anónimo de tu conexión como respaldo.
      </p>
    </form>
  );
}
