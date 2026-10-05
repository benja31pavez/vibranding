import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitOnboarding } from "@/lib/onboarding/public.functions";
import {
  FIELD_STEP,
  OnboardingForm,
  buildPayload,
  payloadTooLarge,
  type FieldError,
} from "@/lib/onboarding/schema";
import {
  STEPS,
  initialState,
  toFormData,
  validateStep,
  type FieldErrors,
  type FormState,
} from "./formState";
import { AccessStepFields } from "./steps/AccessStepFields";
import { BillingStepFields } from "./steps/BillingStepFields";
import { BusinessStepFields } from "./steps/BusinessStepFields";
import { FilesStepFields } from "./steps/FilesStepFields";
import { SocialStepFields } from "./steps/SocialStepFields";

interface Props {
  token: string;
  onDone: () => void;
}

/** Clave de error en el formulario para un error de campo del servidor. */
function serverErrorKey(err: FieldError): string {
  return err.field ?? "_form";
}

/** Formulario por pasos. Valida cada paso con zod antes de avanzar y todo antes de enviar. */
export function OnboardingWizard({ token, onDone }: Props) {
  const [state, setState] = useState<FormState>(initialState);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Antes de hidratar, un submit nativo (GET) pondría los datos en la URL: el botón espera a React.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const last = step === STEPS.length - 1;
  const uploading = state.archivos.some((f) => f.status === "uploading");

  const update = (patch: Partial<FormState>) => setState((s) => ({ ...s, ...patch }));
  const updateFiles = (fn: (files: FormState["archivos"]) => FormState["archivos"]) =>
    setState((s) => ({ ...s, archivos: fn(s.archivos) }));

  const goTo = (next: number) => {
    setStep(next);
    setErrors({});
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const focusFirstError = () =>
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );

  const next = () => {
    const found = validateStep(step, state);
    setErrors(found);
    if (Object.keys(found).length === 0) goTo(step + 1);
    else focusFirstError();
  };

  /** Primer paso con errores (para volver ahí). */
  const firstInvalidStep = (): number | null => {
    for (let i = 0; i < STEPS.length; i++) {
      if (Object.keys(validateStep(i, state)).length > 0) return i;
    }
    return null;
  };

  const showServerError = (err: FieldError) => {
    const target = err.field ? FIELD_STEP[err.field] : undefined;
    if (target !== undefined && target !== step) goTo(target);
    setErrors({ [serverErrorKey(err)]: err.message });
    setFormError(err.message);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!last) return next();
    if (uploading || busy) return;
    setFormError(null);
    const invalid = firstInvalidStep();
    if (invalid !== null) {
      goTo(invalid);
      setErrors(validateStep(invalid, state));
      setFormError("Falta corregir algunos datos en este paso.");
      return;
    }
    const parsed = OnboardingForm.safeParse(toFormData(state));
    if (!parsed.success) {
      setFormError("Revisa los datos del formulario.");
      return;
    }
    const payload = buildPayload(parsed.data);
    if (payloadTooLarge(payload)) {
      setFormError("El formulario es demasiado largo. Acorta los textos más extensos.");
      return;
    }
    setBusy(true);
    try {
      const res = await submitOnboarding({ data: { token, payload } });
      if (res.ok) return onDone();
      if (res.reason === "invalid_payload") return showServerError(res.error);
      setFormError(res.message);
    } catch (err) {
      console.error("[onboarding] envío falló", err);
      setFormError("No pudimos enviar el formulario. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const stepProps = { state, update, errors };

  return (
    <form ref={formRef} method="post" onSubmit={submit} noValidate className="space-y-6">
      <ol className="flex gap-1.5" aria-label="Pasos del formulario">
        {STEPS.map((s, i) => (
          <li key={s.short} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <span
              className={`block h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
              aria-hidden
            />
            <span
              className={`mt-1.5 hidden text-xs sm:block ${i === step ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {s.short}
            </span>
            <span className="sr-only">
              Paso {i + 1}: {s.title}
              {i < step ? " (completo)" : ""}
            </span>
          </li>
        ))}
      </ol>

      <section className="rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Paso {step + 1} de {STEPS.length}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-5 mt-1 scroll-mt-6 text-xl font-semibold text-foreground outline-none"
        >
          {STEPS[step].title}
        </h2>
        {step === 0 && <BillingStepFields {...stepProps} />}
        {step === 1 && <BusinessStepFields {...stepProps} />}
        {step === 2 && <SocialStepFields {...stepProps} />}
        {step === 3 && <AccessStepFields {...stepProps} />}
        {step === 4 && <FilesStepFields {...stepProps} token={token} updateFiles={updateFiles} />}
      </section>

      {formError && (
        <p
          role="alert"
          className="rounded-app-md bg-danger-subtle px-3 py-2 text-sm text-danger-strong"
        >
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => goTo(step - 1)}
            disabled={busy}
          >
            <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" /> Atrás
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          size="lg"
          disabled={!hydrated || busy || (last && uploading)}
          className="sm:min-w-44"
        >
          {busy && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
          {last ? (
            <>{!busy && <Send aria-hidden className="mr-1.5 h-4 w-4" />} Enviar todo</>
          ) : (
            <>
              Siguiente <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      {last && (
        <p className="text-center text-xs text-muted-foreground">
          Puedes enviar el formulario una sola vez. Si después quieres cambiar algo, escríbenos.
        </p>
      )}
    </form>
  );
}
