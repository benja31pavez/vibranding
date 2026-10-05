import { useEffect, useState, type FormEvent } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { ProfileField, SectionFooter } from "./ProfileField";
import {
  INVALID_CODE_MESSAGE,
  MIN_PASSWORD_LENGTH,
  OTP_LENGTH,
  changePasswordErrorMessage,
  resendSecondsLeft,
  sanitizeOtp,
  sendCodeErrorMessage,
  validatePasswordChange,
  type PasswordChangeErrors,
} from "./profileUtils";

/** Lo único que usa esta sección de Supabase Auth (inyectable para probarla sin red). */
export type PasswordAuth = Pick<typeof supabase.auth, "reauthenticate" | "updateUser">;

const TICK_MS = 1000;
const OTP_SLOTS = Array.from({ length: OTP_LENGTH }, (_, i) => i);

/**
 * Cambio de contraseña en dos pasos: primero se envía un código al email de la cuenta
 * (reautenticación de Supabase) y luego se usa como `nonce` al guardar la nueva clave.
 */
export function SecuritySection({
  email,
  auth = supabase.auth,
}: {
  email: string;
  auth?: PasswordAuth;
}) {
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);

  const secondsLeft = resendSecondsLeft(sentAt, now);
  const counting = secondsLeft > 0;
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [counting]);

  const sendCode = async () => {
    setSending(true);
    try {
      const { error } = await auth.reauthenticate();
      if (error) {
        console.error("[profile] error al enviar el código de reautenticación", error);
        toast.error(sendCodeErrorMessage(error));
        return;
      }
      const t = Date.now();
      setSentAt(t);
      setNow(t);
      toast.success("Código enviado", { description: `Revisa ${email}` });
    } catch (err) {
      console.error("[profile] fallo inesperado al enviar el código", err);
      toast.error(sendCodeErrorMessage({}));
    } finally {
      setSending(false);
    }
  };

  if (sentAt === null) {
    return <RequestCodeStep email={email} sending={sending} onSend={() => void sendCode()} />;
  }
  return (
    <VerifyCodeStep
      email={email}
      auth={auth}
      secondsLeft={secondsLeft}
      sending={sending}
      onResend={() => void sendCode()}
      onDone={() => setSentAt(null)}
    />
  );
}

function RequestCodeStep({
  email,
  sending,
  onSend,
}: {
  email: string;
  sending: boolean;
  onSend: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Para cambiar tu contraseña te enviaremos un código de {OTP_LENGTH} dígitos a{" "}
        <strong className="break-words text-foreground">{email}</strong>.
      </p>
      <div className="mt-auto">
        <SectionFooter>
          <Button type="button" onClick={onSend} disabled={sending} className="max-w-full">
            {sending ? <Loader2 className="animate-spin" /> : <MailCheck />}
            <span className="truncate">
              {sending ? (
                "Enviando…"
              ) : (
                <>
                  Enviar código<span className="hidden sm:inline"> a {email}</span>
                </>
              )}
            </span>
          </Button>
        </SectionFooter>
      </div>
    </div>
  );
}

interface VerifyCodeStepProps {
  email: string;
  auth: PasswordAuth;
  secondsLeft: number;
  sending: boolean;
  onResend: () => void;
  onDone: () => void;
}

function VerifyCodeStep({
  email,
  auth,
  secondsLeft,
  sending,
  onResend,
  onDone,
}: VerifyCodeStepProps) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validatePasswordChange(code, password, confirm);
    setErrors(invalid);
    if (Object.keys(invalid).length > 0) return;
    setBusy(true);
    try {
      const { error } = await auth.updateUser({ password, nonce: code });
      if (error) {
        console.error("[profile] error al cambiar la contraseña", error);
        const message = changePasswordErrorMessage(error);
        if (message === INVALID_CODE_MESSAGE) {
          setCode("");
          setErrors({ code: message });
        }
        toast.error(message);
        return;
      }
      toast.success("Contraseña actualizada");
      onDone();
    } catch (err) {
      console.error("[profile] fallo inesperado al cambiar la contraseña", err);
      toast.error(changePasswordErrorMessage({}));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? "Ocultar contraseñas" : "Mostrar contraseñas"}
      aria-pressed={visible}
    >
      {visible ? <EyeOff /> : <Eye />}
    </Button>
  );

  return (
    <form onSubmit={(e) => void submit(e)} className="flex h-full flex-col gap-4" noValidate>
      {/* Ayuda a los gestores de contraseñas a asociar la nueva clave con la cuenta. */}
      <input type="email" value={email} autoComplete="username" readOnly hidden />
      <p role="status" className="text-sm text-muted-foreground">
        Te enviamos un código de {OTP_LENGTH} dígitos a{" "}
        <strong className="break-words text-foreground">{email}</strong>.{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={onResend}
          disabled={sending || secondsLeft > 0}
        >
          {secondsLeft > 0 ? `Reenviar en ${secondsLeft} s` : "Reenviar código"}
        </Button>
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="security-code">Código</Label>
        <InputOTP
          id="security-code"
          maxLength={OTP_LENGTH}
          value={code}
          onChange={(v) => setCode(sanitizeOtp(v))}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-invalid={errors.code ? true : undefined}
          aria-describedby={errors.code ? "security-code-error" : undefined}
        >
          <InputOTPGroup>
            {OTP_SLOTS.map((i) => (
              <InputOTPSlot key={i} index={i} className="h-10 w-10 text-base" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {errors.code && (
          <p id="security-code-error" className="text-xs text-danger-strong">
            {errors.code}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <ProfileField
          id="security-new"
          label="Nueva contraseña"
          type={visible ? "text" : "password"}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
          trailing={toggle}
        />
        <ProfileField
          id="security-confirm"
          label="Repite la contraseña"
          type={visible ? "text" : "password"}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={errors.password}
        />
      </div>
      <div className="mt-auto">
        <SectionFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !password}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Actualizando…" : "Cambiar contraseña"}
          </Button>
        </SectionFooter>
      </div>
    </form>
  );
}
