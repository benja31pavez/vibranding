import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProfileField, SectionFooter } from "./ProfileField";
import { MIN_PASSWORD_LENGTH, passwordError } from "./profileUtils";

/** Cambio de contraseña con la sesión actual (mismo flujo que /reset-password). */
export function SecuritySection({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = passwordError(password, confirm);
    setError(invalid);
    if (invalid) return;
    setBusy(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      console.error("[profile] error al cambiar la contraseña", authError);
      return toast.error("No se pudo cambiar la contraseña", { description: authError.message });
    }
    setPassword("");
    setConfirm("");
    toast.success("Contraseña actualizada");
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex h-full flex-col gap-5" noValidate>
      {/* Ayuda a los gestores de contraseñas a asociar la nueva clave con la cuenta. */}
      <input type="email" value={email} autoComplete="username" readOnly hidden />
      <p className="text-sm text-muted-foreground">
        Cambia la contraseña con la que entras como <strong>{email}</strong>. Seguirás con la sesión
        abierta en este navegador.
      </p>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <ProfileField
          id="security-new"
          label="Nueva contraseña"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
        />
        <ProfileField
          id="security-confirm"
          label="Repite la contraseña"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={error}
        />
      </div>
      <div className="mt-auto">
        <SectionFooter>
          <Button type="submit" disabled={busy || !password}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Actualizando…" : "Cambiar contraseña"}
          </Button>
        </SectionFooter>
      </div>
    </form>
  );
}
