import { useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { trackLandingEvent } from "@/lib/track";
import { submitDiagnostico } from "@/lib/leads/diagnostico.functions";
import {
  BUDGETS,
  CONSENT_TEXT,
  DiagnosticoInput,
  GOALS,
  INFO_MAX,
  MARKETING_CONSENT_TEXT,
  type PlanInterest,
} from "@/lib/leads/diagnostico.schema";
import { whatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

type FieldName =
  | "negocio"
  | "rubro"
  | "comuna"
  | "presencia"
  | "whatsapp"
  | "email"
  | "objetivo"
  | "presupuesto"
  | "info"
  | "consentimiento"
  | "marketing";

type Values = Record<Exclude<FieldName, "consentimiento" | "marketing">, string> & {
  consentimiento: boolean;
  marketing: boolean;
  website: string;
};

const EMPTY: Values = {
  negocio: "",
  rubro: "",
  comuna: "",
  presencia: "",
  whatsapp: "",
  email: "",
  objetivo: "",
  presupuesto: "",
  info: "",
  consentimiento: false,
  marketing: false,
  website: "",
};

const FIELD_ORDER: FieldName[] = [
  "negocio",
  "rubro",
  "comuna",
  "presencia",
  "whatsapp",
  "email",
  "objetivo",
  "presupuesto",
  "info",
  "consentimiento",
  "marketing",
];

const NOT_SAVED_MESSAGE = "No pudimos registrar tu solicitud. Escríbenos por WhatsApp.";
const RATE_LIMITED_MESSAGE =
  "Recibimos varios envíos desde tu conexión. Espera un rato o escríbenos por WhatsApp.";
const INVALID_MESSAGE = "Revisa los datos del formulario e inténtalo de nuevo.";
const NETWORK_MESSAGE =
  "No pudimos enviar el formulario. Inténtalo de nuevo o escríbenos por WhatsApp.";

type FormError = { text: string; whatsapp: boolean };

const inputCls =
  "block h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

/** Asterisco visible de campo obligatorio (los lectores usan aria-required). */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-red-700 dark:text-red-300">
      *
    </span>
  );
}

function OptionalMark() {
  return <span className="font-normal text-muted-foreground">(opcional)</span>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-300">
      {message}
    </p>
  );
}

export function DiagnosticoForm({
  plan,
  onDone,
}: {
  plan?: PlanInterest;
  onDone: (negocio: string) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [formError, setFormError] = useState<FormError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key as FieldName]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const focusFirstError = (errs: Partial<Record<FieldName, string>>) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
    el?.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setFormError(null);
    const payload = { ...values, plan, presupuesto: values.presupuesto || undefined };
    const parsed = DiagnosticoInput.safeParse(payload);
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldName;
        if (FIELD_ORDER.includes(key) && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      focusFirstError(next);
      return;
    }
    setStatus("sending");
    try {
      const res = await submitDiagnostico({ data: parsed.data });
      if (res.ok) {
        trackLandingEvent("contact_submit", "es", plan ? `diagnostico:${plan}` : "diagnostico");
        onDone(parsed.data.negocio);
        return;
      }
      if (res.reason === "not_saved") setFormError({ text: NOT_SAVED_MESSAGE, whatsapp: true });
      else if (res.reason === "rate_limited")
        setFormError({ text: RATE_LIMITED_MESSAGE, whatsapp: true });
      else setFormError({ text: INVALID_MESSAGE, whatsapp: false });
    } catch {
      setFormError({ text: NETWORK_MESSAGE, whatsapp: true });
    } finally {
      setStatus("idle");
    }
  };

  const describedBy = (name: FieldName, hint?: string) =>
    [hint, errors[name] ? `${name}-error` : null].filter(Boolean).join(" ") || undefined;

  const textField = (
    name: Exclude<FieldName, "objetivo" | "presupuesto" | "info" | "consentimiento" | "marketing">,
    label: string,
    opts: {
      type?: string;
      autoComplete?: string;
      placeholder?: string;
      inputMode?: "tel" | "email";
      optional?: boolean;
      hint?: string;
    } = {},
  ) => (
    <div>
      <label htmlFor={`dg-${name}`} className="mb-1.5 block text-sm font-semibold">
        {label}
        {opts.optional ? (
          <>
            {" "}
            <OptionalMark />
          </>
        ) : (
          <RequiredMark />
        )}
      </label>
      {opts.hint && (
        <p id={`${name}-hint`} className="mb-1.5 text-sm text-muted-foreground">
          {opts.hint}
        </p>
      )}
      <input
        id={`dg-${name}`}
        name={name}
        type={opts.type ?? "text"}
        autoComplete={opts.autoComplete}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        required={!opts.optional}
        aria-required={opts.optional ? undefined : true}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={describedBy(name, opts.hint ? `${name}-hint` : undefined)}
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
        className={inputCls}
      />
      <FieldError id={`${name}-error`} message={errors[name]} />
    </div>
  );

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="space-y-5"
      aria-describedby="dg-required-note"
    >
      <p id="dg-required-note" className="text-sm text-muted-foreground">
        Los campos con <span aria-hidden="true">*</span>
        <span className="sr-only">asterisco</span> son obligatorios. Toma 1 minuto.
      </p>

      {textField("negocio", "Nombre de tu negocio", {
        autoComplete: "organization",
        placeholder: "Ej: Paisajismo Los Robles",
      })}
      <div className="grid gap-5 sm:grid-cols-2">
        {textField("rubro", "Rubro", { placeholder: "Ej: paisajismo, estética, gimnasio" })}
        {textField("comuna", "Comuna", {
          autoComplete: "address-level2",
          placeholder: "Ej: Las Condes",
        })}
      </div>
      {textField("presencia", "Instagram o web", {
        optional: true,
        placeholder: "@tunegocio o tunegocio.cl",
        hint: "Si aún no tienes, déjalo en blanco: también te ayudamos.",
      })}
      <div className="grid gap-5 sm:grid-cols-2">
        {textField("whatsapp", "WhatsApp", {
          type: "tel",
          autoComplete: "tel",
          inputMode: "tel",
          placeholder: "+56 9 1234 5678",
        })}
        {textField("email", "Correo", {
          type: "email",
          autoComplete: "email",
          inputMode: "email",
          placeholder: "tu@correo.cl",
        })}
      </div>

      <fieldset
        role="radiogroup"
        aria-required="true"
        aria-invalid={errors.objetivo ? true : undefined}
        aria-describedby={errors.objetivo ? "objetivo-error" : undefined}
      >
        <legend className="mb-2 text-sm font-semibold">
          ¿Qué quieres lograr con Vibranding?
          <RequiredMark />
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOALS.map((g) => (
            <label
              key={g.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-background px-4 py-3 text-sm has-[:checked]:border-[color:var(--brand-2)] has-[:checked]:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                errors.objetivo && "border-destructive",
              )}
            >
              <input
                type="radio"
                name="objetivo"
                value={g.value}
                checked={values.objetivo === g.value}
                onChange={() => set("objetivo", g.value)}
                className="h-4 w-4 shrink-0 accent-[color:var(--brand-2)]"
                aria-invalid={errors.objetivo ? true : undefined}
              />
              {g.label}
            </label>
          ))}
        </div>
        <FieldError id="objetivo-error" message={errors.objetivo} />
      </fieldset>

      <div>
        <label htmlFor="dg-presupuesto" className="mb-1.5 block text-sm font-semibold">
          Presupuesto aproximado para marketing <OptionalMark />
        </label>
        <select
          id="dg-presupuesto"
          name="presupuesto"
          value={values.presupuesto}
          onChange={(e) => set("presupuesto", e.target.value)}
          className={inputCls}
        >
          {BUDGETS.map((b) => (
            <option key={b.value || "none"} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dg-info" className="mb-1.5 block text-sm font-semibold">
          Información adicional <OptionalMark />
        </label>
        <textarea
          id="dg-info"
          name="info"
          rows={4}
          maxLength={INFO_MAX}
          placeholder="Cuéntanos lo que quieras: qué te preocupa hoy, qué has probado, plazos…"
          aria-invalid={errors.info ? true : undefined}
          aria-describedby={describedBy("info", "info-count")}
          value={values.info}
          onChange={(e) => set("info", e.target.value)}
          className={cn(inputCls, "h-auto min-h-28 resize-y py-3")}
        />
        <p
          id="info-count"
          className="mt-1 text-right text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {values.info.length}/{INFO_MAX}
        </p>
        <FieldError id="info-error" message={errors.info} />
      </div>

      {/* Honeypot: invisible para personas y lectores de pantalla. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="dg-website">No llenar este campo</label>
        <input
          id="dg-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="consentimiento"
            checked={values.consentimiento}
            onChange={(e) => set("consentimiento", e.target.checked)}
            aria-required="true"
            aria-invalid={errors.consentimiento ? true : undefined}
            aria-describedby={describedBy("consentimiento")}
            className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--brand-2)]"
          />
          <span>
            {CONSENT_TEXT} Tus datos se usan solo para esto; revisa la{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4"
            >
              política de privacidad<span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
            .
            <RequiredMark />
          </span>
        </label>
        <FieldError id="consentimiento-error" message={errors.consentimiento} />
      </div>

      {/* Consentimiento de marketing: opcional, desmarcado e independiente del anterior. */}
      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="marketing"
            checked={values.marketing}
            onChange={(e) => set("marketing", e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--brand-2)]"
          />
          <span>
            {MARKETING_CONSENT_TEXT} <OptionalMark />
          </span>
        </label>
      </div>

      {formError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-red-700 dark:text-red-300"
        >
          {formError.text}
          {formError.whatsapp && (
            <>
              {" "}
              <a
                href={whatsappUrl(
                  `Hola Vibranding, quiero el diagnóstico gratis. Mi negocio es: ${values.negocio}`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                Abrir WhatsApp
              </a>
            </>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-brand-strong px-7 text-base font-semibold text-white shadow-lg shadow-[color:var(--brand-2)]/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70"
      >
        {status === "sending" ? (
          <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
        ) : (
          <Send aria-hidden className="h-5 w-5" />
        )}
        {status === "sending" ? "Enviando…" : "Quiero mi diagnóstico gratis"}
      </button>
    </form>
  );
}
